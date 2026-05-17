import type {
  Client,
  Company,
  Container,
  RouteEvent,
  WeighingSession,
  ContainerReception,
  Photo,
} from '@/lib/types'

/** Una foto enriquecida con metadatos del contexto (envase, hora, etapa). */
export interface ReportPhotoEntry {
  photo: Photo
  container_id: string
  container: Container | null
  taken_at: string
  /** Texto a renderizar como "Comentario:" debajo de la foto. */
  comment: string
}

export interface PhotographicReportData {
  company: Company
  client: Client
  weekStart: string // ISO date YYYY-MM-DD
  weekEnd: string   // ISO date YYYY-MM-DD
  generatedAt: string // ISO datetime
  // Fotos agrupadas por etapa. Toda la data es de la misma empresa.
  byStage: {
    route: ReportPhotoEntry[]
    weighing: ReportPhotoEntry[]
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

/** Devuelve true si `value` (ISO datetime) cae dentro de `[start, end]` inclusivos. */
export function withinRange(value: string, start: Date, end: Date): boolean {
  const t = new Date(value).getTime()
  return t >= start.getTime() && t <= end.getTime()
}

/**
 * Arma el reporte fotográfico de una empresa para la semana actual.
 * - Devuelve null si la empresa no existe.
 * - El rango es [lunes 00:00, ahora] por defecto. `endOverride` permite testing.
 */
export function buildPhotographicReportData(
  companyId: string,
  store: ReportStoreSlice,
  endOverride?: Date,
): PhotographicReportData | null {
  const company = store.companies.find((co) => co.id === companyId)
  if (!company) return null
  const client = store.clients.find((c) => c.id === company.client_id)
  if (!client) return null

  const end = endOverride ?? new Date()
  const start = getMondayOfWeek(end)

  // 1. Containers de la empresa
  const containers = store.containers.filter((c) => c.company_id === companyId)
  const containerIds = new Set(containers.map((c) => c.id))
  const containerMap = new Map(containers.map((c) => [c.id, c]))

  // 2. RouteEvents dentro del rango cuyos containers tocan esta empresa
  const routeEvents = store.routeEvents.filter((r) => {
    if (!withinRange(r.started_at, start, end)) return false
    return (
      r.containers_dirty_received.some((cid) => containerIds.has(cid)) ||
      r.containers_clean_delivered.some((cid) => containerIds.has(cid))
    )
  })

  // 3. Receptions de containers de la empresa dentro del rango
  const receptions = store.receptions.filter((r) => {
    if (!containerIds.has(r.container_id)) return false
    return withinRange(r.arrived_at, start, end)
  })

  // 4. Recolectar fotos por etapa
  const photoMap = new Map(store.photos.map((p) => [p.id, p]))

  // 4a. Recorridos
  const routePhotos: ReportPhotoEntry[] = []
  for (const ev of routeEvents) {
    // Solo los envases del recorrido que pertenecen a ESTA empresa
    const dirtyOfCompany = ev.containers_dirty_received.filter((cid) => containerIds.has(cid))
    const cleanOfCompany = ev.containers_clean_delivered.filter((cid) => containerIds.has(cid))
    if (dirtyOfCompany.length === 0 && cleanOfCompany.length === 0) continue

    const dirtyText = dirtyOfCompany.length > 0 ? `Recogidos: ${dirtyOfCompany.join(', ')}` : null
    const cleanText = cleanOfCompany.length > 0 ? `Entregados: ${cleanOfCompany.join(', ')}` : null
    const envasesText = [dirtyText, cleanText].filter(Boolean).join(' · ')
    const time = new Date(ev.started_at).toLocaleTimeString('es-PA', { hour: '2-digit', minute: '2-digit' })

    for (const photoId of ev.photo_ids) {
      const photo = photoMap.get(photoId)
      if (!photo) continue
      routePhotos.push({
        photo,
        container_id: dirtyOfCompany[0] ?? cleanOfCompany[0] ?? '',
        container: null,
        taken_at: photo.taken_at,
        comment: `Recorrido ${time} · Piso ${ev.floor || '—'}, ${ev.area || '—'} · ${envasesText}`,
      })
    }
  }

  // 4b. Pesajes
  const weighingPhotos: ReportPhotoEntry[] = []
  for (const r of receptions) {
    const container = containerMap.get(r.container_id)
    if (!container) continue
    const time = new Date(r.arrived_at).toLocaleTimeString('es-PA', { hour: '2-digit', minute: '2-digit' })
    const netRaw = r.gross_weight_kg - container.tare_weight_kg
    const net = Math.round(netRaw * 100) / 100
    r.photo_ids.forEach((photoId, idx) => {
      const photo = photoMap.get(photoId)
      if (!photo) return
      const kind = idx === 0 ? 'Envase' : 'Balanza'
      weighingPhotos.push({
        photo,
        container_id: r.container_id,
        container,
        taken_at: photo.taken_at,
        comment: `Pesaje ${time} · ${kind} · Envase ${r.container_id} · Neto ${net} kg`,
      })
    })
  }

  // Ordenar cronológicamente
  const byTakenAt = (a: ReportPhotoEntry, b: ReportPhotoEntry) =>
    new Date(a.taken_at).getTime() - new Date(b.taken_at).getTime()
  routePhotos.sort(byTakenAt)
  weighingPhotos.sort(byTakenAt)

  return {
    company,
    client,
    weekStart: isoDate(start),
    weekEnd: isoDate(end),
    generatedAt: new Date().toISOString(),
    byStage: {
      route: routePhotos,
      weighing: weighingPhotos,
    },
    meta: {
      routeEventCount: routeEvents.length,
      weighingReceptionCount: receptions.length,
      totalPhotos: routePhotos.length + weighingPhotos.length,
    },
  }
}
