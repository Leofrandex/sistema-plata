import type {
  Client,
  Company,
  Container,
  RouteEvent,
  WeighingSession,
  ContainerReception,
  Photo,
} from '@/lib/types'

/** Una foto enriquecida con metadatos del contexto (envase, empresa, hora). */
export interface ReportPhotoEntry {
  photo: Photo
  container_id: string
  container: Container | null
  company_id: string | null
  company_name: string | null
  taken_at: string
  /** Texto a renderizar como "Comentario:" debajo de la foto. */
  comment: string
}

export interface ReportGroupedByCompany {
  company: Company
  photos: ReportPhotoEntry[]
}

export interface PhotographicReportData {
  client: Client
  weekStart: string // ISO date YYYY-MM-DD
  weekEnd: string   // ISO date YYYY-MM-DD
  generatedAt: string // ISO datetime
  // Fotos agrupadas por etapa y, dentro de cada etapa, por empresa.
  byStage: {
    route: ReportGroupedByCompany[]
    weighing: ReportGroupedByCompany[]
  }
  meta: {
    routeEventCount: number
    weighingReceptionCount: number
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

/**
 * Devuelve el lunes 00:00:00 local de la semana que contiene `reference`.
 * Considera lunes como inicio de semana (locale español; getDay() devuelve
 * 0=domingo .. 6=sábado).
 */
export function getMondayOfWeek(reference: Date = new Date()): Date {
  const d = new Date(reference)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day // si es domingo, retroceder 6 días
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

/** Devuelve true si `value` (ISO datetime o date) cae dentro de `[start, end]` inclusivos. */
export function withinRange(value: string, start: Date, end: Date): boolean {
  const t = new Date(value).getTime()
  return t >= start.getTime() && t <= end.getTime()
}

/**
 * Arma el reporte fotográfico de un cliente para la semana actual.
 * - Lee `clientId` y devuelve null si el cliente no existe.
 * - El rango es [lunes 00:00, ahora] por defecto. `endOverride` permite testing.
 */
export function buildPhotographicReportData(
  clientId: string,
  store: ReportStoreSlice,
  endOverride?: Date,
): PhotographicReportData | null {
  const client = store.clients.find((c) => c.id === clientId)
  if (!client) return null

  const end = endOverride ?? new Date()
  const start = getMondayOfWeek(end)

  // 1. Companies del cliente
  const companies = store.companies.filter((co) => co.client_id === clientId)
  const companyIds = new Set(companies.map((co) => co.id))
  const companyMap = new Map(companies.map((co) => [co.id, co]))

  // 2. Containers de esas companies
  const containers = store.containers.filter((c) => companyIds.has(c.company_id))
  const containerIds = new Set(containers.map((c) => c.id))
  const containerMap = new Map(containers.map((c) => [c.id, c]))

  // 3. RouteEvents del cliente dentro del rango cuyos containers tocan empresas del cliente
  const routeEvents = store.routeEvents.filter((r) => {
    if (r.client_id !== clientId) return false
    if (!withinRange(r.started_at, start, end)) return false
    return r.containers_exchanged.some((cid) => containerIds.has(cid))
  })

  // 4. Receptions de containers del cliente dentro del rango
  const receptions = store.receptions.filter((r) => {
    if (!containerIds.has(r.container_id)) return false
    return withinRange(r.arrived_at, start, end)
  })

  // 5. Recolectar fotos por etapa
  const photoMap = new Map(store.photos.map((p) => [p.id, p]))

  // 5a. Recorridos: cada RouteEvent puede tener varios containers + varias fotos.
  // Asignamos todas las fotos del recorrido a CADA empresa que aparece en ese
  // recorrido (porque no podemos saber a qué envase corresponde cada foto).
  const routePhotosByCompany = new Map<string, ReportPhotoEntry[]>()
  for (const ev of routeEvents) {
    const companiesInEvent = new Set<string>()
    for (const cid of ev.containers_exchanged) {
      const container = containerMap.get(cid)
      if (container) companiesInEvent.add(container.company_id)
    }
    // Construir el texto de comentario con la lista de envases del recorrido
    const envasesText = ev.containers_exchanged.join(', ')
    const time = new Date(ev.started_at).toLocaleTimeString('es-PA', {
      hour: '2-digit',
      minute: '2-digit',
    })
    for (const photoId of ev.photo_ids) {
      const photo = photoMap.get(photoId)
      if (!photo) continue
      for (const companyId of companiesInEvent) {
        const company = companyMap.get(companyId)
        if (!company) continue
        const entry: ReportPhotoEntry = {
          photo,
          container_id: ev.containers_exchanged.find((cid) => containerMap.get(cid)?.company_id === companyId) ?? '',
          container: null,
          company_id: companyId,
          company_name: company.name,
          taken_at: photo.taken_at,
          comment: `Recorrido ${time} · Piso ${ev.floor || '—'}, ${ev.area || '—'} · Envases: ${envasesText}`,
        }
        if (!routePhotosByCompany.has(companyId)) routePhotosByCompany.set(companyId, [])
        routePhotosByCompany.get(companyId)!.push(entry)
      }
    }
  }

  // 5b. Pesajes: cada reception tiene container_id y photo_ids (envase + balanza)
  const weighingPhotosByCompany = new Map<string, ReportPhotoEntry[]>()
  for (const r of receptions) {
    const container = containerMap.get(r.container_id)
    if (!container) continue
    const company = companyMap.get(container.company_id)
    if (!company) continue
    const time = new Date(r.arrived_at).toLocaleTimeString('es-PA', {
      hour: '2-digit',
      minute: '2-digit',
    })
    const netRaw = r.gross_weight_kg - container.tare_weight_kg
    const net = Math.round(netRaw * 100) / 100
    r.photo_ids.forEach((photoId, idx) => {
      const photo = photoMap.get(photoId)
      if (!photo) return
      const kind = idx === 0 ? 'Envase' : 'Balanza'
      const entry: ReportPhotoEntry = {
        photo,
        container_id: r.container_id,
        container,
        company_id: company.id,
        company_name: company.name,
        taken_at: photo.taken_at,
        comment: `Pesaje ${time} · ${kind} · Envase ${r.container_id} · Neto ${net} kg`,
      }
      if (!weighingPhotosByCompany.has(company.id)) weighingPhotosByCompany.set(company.id, [])
      weighingPhotosByCompany.get(company.id)!.push(entry)
    })
  }

  // Ordenar fotos por taken_at ASC dentro de cada empresa
  function sortByTakenAt(a: ReportPhotoEntry, b: ReportPhotoEntry) {
    return new Date(a.taken_at).getTime() - new Date(b.taken_at).getTime()
  }
  for (const arr of routePhotosByCompany.values()) arr.sort(sortByTakenAt)
  for (const arr of weighingPhotosByCompany.values()) arr.sort(sortByTakenAt)

  // Convertir maps a arrays ordenados alfabéticamente por nombre de empresa
  function mapToGroupedArray(map: Map<string, ReportPhotoEntry[]>): ReportGroupedByCompany[] {
    return Array.from(map.entries())
      .map(([companyId, photos]) => {
        const company = companyMap.get(companyId)!
        return { company, photos }
      })
      .sort((a, b) => a.company.name.localeCompare(b.company.name))
  }

  const routeGrouped = mapToGroupedArray(routePhotosByCompany)
  const weighingGrouped = mapToGroupedArray(weighingPhotosByCompany)

  const totalPhotos =
    routeGrouped.reduce((acc, g) => acc + g.photos.length, 0) +
    weighingGrouped.reduce((acc, g) => acc + g.photos.length, 0)

  return {
    client,
    weekStart: isoDate(start),
    weekEnd: isoDate(end),
    generatedAt: new Date().toISOString(),
    byStage: {
      route: routeGrouped,
      weighing: weighingGrouped,
    },
    meta: {
      routeEventCount: routeEvents.length,
      weighingReceptionCount: receptions.length,
      totalPhotos,
    },
  }
}
