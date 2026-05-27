import type {
  Client,
  Company,
  Container,
  RouteEvent,
  WeighingSession,
  ContainerReception,
  Photo,
  RouteSlot,
} from '@/lib/types'
import { getRouteSlotDefinition } from '@/lib/constants'

/** Una foto enriquecida con metadatos del contexto. */
export interface ReportPhotoEntry {
  photo: Photo
  container_id: string
  container: Container | null
  taken_at: string
  comment: string
}

/** Grupo de fotos con una etiqueta (se renderiza como un "cuadro" o varios si >8). */
export interface ReportPhotoGroup {
  label: string
  stage: 'route' | 'weighing'
  photos: ReportPhotoEntry[]
}

/** Un día del reporte. Cada día arranca en página nueva. */
export interface ReportDay {
  date: string // YYYY-MM-DD local
  groups: ReportPhotoGroup[]
}

export interface PhotographicReportData {
  company: Company
  client: Client
  rangeStart: string // YYYY-MM-DD
  rangeEnd: string // YYYY-MM-DD
  generatedAt: string
  days: ReportDay[]
  meta: {
    routeEventCount: number
    weighingReceptionCount: number
    routePhotoCount: number
    weighingPhotoCount: number
    totalPhotos: number
  }
}

export interface ReportStoreSlice {
  clients: Client[]
  companies: Company[]
  containers: Container[]
  routeEvents: RouteEvent[]
  weighingSessions: WeighingSession[]
  receptions: ContainerReception[]
  photos: Photo[]
}

export interface ReportRange {
  start: Date
  end: Date
}

/** Lunes 00:00 local de la semana que contiene `reference`. */
export function getMondayOfWeek(reference: Date = new Date()): Date {
  const d = new Date(reference)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

/** Formatea una Date como `YYYY-MM-DD` en zona local. */
export function isoDate(date: Date): string {
  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

/** true si `value` (ISO datetime) cae dentro de `[start, end]` inclusivos. */
export function withinRange(value: string, start: Date, end: Date): boolean {
  const t = new Date(value).getTime()
  return t >= start.getTime() && t <= end.getTime()
}

/** Parte un array en sub-arrays de tamaño `size`. */
export function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

/**
 * Arma el reporte fotográfico de una empresa para un rango.
 * - Default: [lunes 00:00 de la semana de `now`, `now`].
 * - Devuelve null si la empresa o el cliente no existen.
 *
 * Orden estricto: por día → por ruta (slot, cronológico) → grupo Recorrido luego
 * grupo Pesaje (recepciones de los tachos sucios recogidos en esa ruta). Las
 * recepciones que no estén atadas a ninguna ruta del rango se agrupan por su fecha
 * de pesaje en un grupo "Pesaje" al final del día.
 */
export function buildPhotographicReportData(
  companyId: string,
  store: ReportStoreSlice,
  range?: ReportRange,
): PhotographicReportData | null {
  const company = store.companies.find((co) => co.id === companyId)
  if (!company) return null
  const client = store.clients.find((c) => c.id === company.client_id)
  if (!client) return null

  const end = range?.end ?? new Date()
  const start = range?.start ?? getMondayOfWeek(end)

  const containers = store.containers.filter((c) => c.company_id === companyId)
  const containerIds = new Set(containers.map((c) => c.id))
  const containerMap = new Map(containers.map((c) => [c.id, c]))
  const photoMap = new Map(store.photos.map((p) => [p.id, p]))

  // route_events de andén en el rango que tocan a la empresa
  const routeEvents = store.routeEvents.filter((r) => {
    if (r.kind !== 'anden') return false
    if (!withinRange(r.started_at, start, end)) return false
    return (
      r.containers_dirty_received.some((cid) => containerIds.has(cid)) ||
      r.containers_clean_delivered.some((cid) => containerIds.has(cid))
    )
  })

  // receptions de la empresa en el rango
  const receptions = store.receptions.filter(
    (r) => containerIds.has(r.container_id) && withinRange(r.arrived_at, start, end),
  )

  // Índice: container_id → primera ruta (date, slot) donde fue recogido
  const rutaOfContainer = new Map<string, { date: string; slot: RouteSlot }>()
  const sortedRoutes = [...routeEvents].sort(
    (a, b) => new Date(a.started_at).getTime() - new Date(b.started_at).getTime(),
  )
  for (const ev of sortedRoutes) {
    if (!ev.slot) continue
    for (const cid of ev.containers_dirty_received) {
      if (!containerIds.has(cid)) continue
      if (!rutaOfContainer.has(cid)) {
        rutaOfContainer.set(cid, { date: ev.date, slot: ev.slot })
      }
    }
  }

  type RutaKey = string // `${date}__${slot}`

  // Agrupar route_events por ruta (date, slot)
  const routesByKey = new Map<RutaKey, RouteEvent[]>()
  for (const ev of sortedRoutes) {
    if (!ev.slot) continue
    const key = `${ev.date}__${ev.slot}`
    const arr = routesByKey.get(key) ?? []
    arr.push(ev)
    routesByKey.set(key, arr)
  }

  // Receptions por ruta key (grupo Pesaje de cada ruta) + huérfanas
  const receptionsByRuta = new Map<RutaKey, ContainerReception[]>()
  const orphanReceptions: ContainerReception[] = []
  for (const rec of receptions) {
    const ruta = rutaOfContainer.get(rec.container_id)
    if (ruta) {
      const key = `${ruta.date}__${ruta.slot}`
      const arr = receptionsByRuta.get(key) ?? []
      arr.push(rec)
      receptionsByRuta.set(key, arr)
    } else {
      orphanReceptions.push(rec)
    }
  }

  const byTakenAt = (a: ReportPhotoEntry, b: ReportPhotoEntry) =>
    new Date(a.taken_at).getTime() - new Date(b.taken_at).getTime()

  function routePhotoEntries(events: RouteEvent[]): ReportPhotoEntry[] {
    const out: ReportPhotoEntry[] = []
    for (const ev of events) {
      const dirtyOfCompany = ev.containers_dirty_received.filter((cid) => containerIds.has(cid))
      const cleanOfCompany = ev.containers_clean_delivered.filter((cid) => containerIds.has(cid))
      for (const photoId of ev.photo_ids) {
        const photo = photoMap.get(photoId)
        if (!photo) continue
        out.push({
          photo,
          container_id: dirtyOfCompany[0] ?? cleanOfCompany[0] ?? '',
          container: null,
          taken_at: photo.taken_at,
          comment: '',
        })
      }
    }
    return out.sort(byTakenAt)
  }

  function weighingPhotoEntries(recs: ContainerReception[]): ReportPhotoEntry[] {
    const out: ReportPhotoEntry[] = []
    const sorted = [...recs].sort(
      (a, b) => new Date(a.arrived_at).getTime() - new Date(b.arrived_at).getTime(),
    )
    for (const rec of sorted) {
      const container = containerMap.get(rec.container_id) ?? null
      for (const photoId of rec.photo_ids) {
        const photo = photoMap.get(photoId)
        if (!photo) continue
        out.push({
          photo,
          container_id: rec.container_id,
          container,
          taken_at: photo.taken_at,
          comment: '',
        })
      }
    }
    return out
  }

  // Construir mapa día → grupos
  const dayMap = new Map<string, ReportPhotoGroup[]>()
  function pushGroup(date: string, group: ReportPhotoGroup) {
    if (group.photos.length === 0) return
    const arr = dayMap.get(date) ?? []
    arr.push(group)
    dayMap.set(date, arr)
  }

  // Rutas ordenadas por (date, slot)
  const rutaKeys = [...routesByKey.keys()].sort((a, b) => {
    const [da, sa] = a.split('__')
    const [db, sb] = b.split('__')
    if (da !== db) return da < db ? -1 : 1
    return sa < sb ? -1 : 1
  })
  for (const key of rutaKeys) {
    const [date, slot] = key.split('__') as [string, RouteSlot]
    const def = getRouteSlotDefinition(slot)
    const events = routesByKey.get(key)!
    pushGroup(date, {
      label: `Recorrido — ${def.ordinal} ruta ${def.shortLabel}`,
      stage: 'route',
      photos: routePhotoEntries(events),
    })
    pushGroup(date, {
      label: `Pesaje — ${def.ordinal} ruta`,
      stage: 'weighing',
      photos: weighingPhotoEntries(receptionsByRuta.get(key) ?? []),
    })
  }

  // Pesajes huérfanos (sin recorrido en el rango): agrupar por fecha de pesaje
  const orphanByDate = new Map<string, ContainerReception[]>()
  for (const rec of orphanReceptions) {
    const d = isoDate(new Date(rec.arrived_at))
    const arr = orphanByDate.get(d) ?? []
    arr.push(rec)
    orphanByDate.set(d, arr)
  }
  for (const [date, recs] of orphanByDate) {
    pushGroup(date, {
      label: 'Pesaje',
      stage: 'weighing',
      photos: weighingPhotoEntries(recs),
    })
  }

  const days: ReportDay[] = [...dayMap.keys()]
    .sort()
    .map((date) => ({ date, groups: dayMap.get(date)! }))

  let routePhotoCount = 0
  let weighingPhotoCount = 0
  for (const day of days) {
    for (const g of day.groups) {
      if (g.stage === 'route') routePhotoCount += g.photos.length
      else weighingPhotoCount += g.photos.length
    }
  }

  return {
    company,
    client,
    rangeStart: isoDate(start),
    rangeEnd: isoDate(end),
    generatedAt: new Date().toISOString(),
    days,
    meta: {
      routeEventCount: routeEvents.length,
      weighingReceptionCount: receptions.length,
      routePhotoCount,
      weighingPhotoCount,
      totalPhotos: routePhotoCount + weighingPhotoCount,
    },
  }
}
