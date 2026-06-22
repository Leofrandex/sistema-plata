import type {
  Client,
  Company,
  Container,
  ContainerLocation,
  ContainerReception,
  ExternalTransfer,
  RouteEvent,
  StorageEvent,
  TreatmentRun,
} from '@/lib/types'
import { computeNetWeight } from './containers'

// ─── Circulación de tachos ────────────────────────────────────────────────

export type CirculationBucket =
  | 'en_planta'        // limpio físicamente en planta (recién dado de alta o tratado), sin entregar
  | 'en_cliente'       // entregado limpio en recorrido, esperando recogida sucia
  | 'pendiente_pesar'  // recogido sucio, sin recepción vigente
  | 'pendiente_tratar' // pesado, esperando tratamiento

export interface CirculationBreakdown {
  total: number
  buckets: Array<{ key: CirculationBucket; label: string; count: number; color: string }>
}

const BUCKET_DEFINITIONS: Array<{ key: CirculationBucket; label: string; color: string }> = [
  { key: 'en_planta',        label: 'En planta',           color: '#16A34A' }, // verde
  { key: 'en_cliente',       label: 'En cliente',          color: '#F97316' }, // naranja
  { key: 'pendiente_pesar',  label: 'Pendiente por pesar', color: '#94A3B8' }, // gris
  { key: 'pendiente_tratar', label: 'Pendiente por tratar', color: '#DC2626' }, // rojo
]

const BUCKET_BY_KEY = new Map(BUCKET_DEFINITIONS.map((d) => [d.key, d]))

/** Color hex del estado de circulación (mismo que usa el dashboard). */
export function circulationColor(bucket: CirculationBucket): string {
  return BUCKET_BY_KEY.get(bucket)!.color
}

/** Label en español del estado de circulación. */
export function circulationLabel(bucket: CirculationBucket): string {
  return BUCKET_BY_KEY.get(bucket)!.label
}

interface CirculationStoreSlice {
  containers: Container[]
  routeEvents: RouteEvent[]
  receptions: ContainerReception[]
  storageEvents: StorageEvent[]
  treatmentRuns: TreatmentRun[]
  externalTransfers: ExternalTransfer[]
  locations: ContainerLocation[]
}

interface CirculationTimelineSlice {
  routeEvents: RouteEvent[]
  receptions: ContainerReception[]
  treatmentRuns: TreatmentRun[]
  externalTransfers: ExternalTransfer[]
}

/**
 * Clasifica un tacho en uno de los 4 buckets de circulación según su evento
 * VIGENTE más reciente (modelo de línea de tiempo). Recorridos y recepciones
 * anulados (voided_at) se ignoran. Spec 2026-06-17.
 */
export function computeCirculationBucket(
  container: Container,
  store: CirculationTimelineSlice,
): CirculationBucket {
  const t = (iso: string | null | undefined): number => (iso ? new Date(iso).getTime() : -Infinity)

  let cleanDelivered = -Infinity
  let dirtyReceived = -Infinity
  for (const r of store.routeEvents) {
    if (r.voided_at) continue
    const ts = t(r.started_at)
    if (r.containers_clean_delivered.includes(container.id) && ts > cleanDelivered) cleanDelivered = ts
    if (r.containers_dirty_received.includes(container.id) && ts > dirtyReceived) dirtyReceived = ts
  }

  let reception = -Infinity
  for (const r of store.receptions) {
    if (r.voided_at) continue
    if (r.container_id !== container.id) continue
    const ts = t(r.arrived_at)
    if (ts > reception) reception = ts
  }

  let closed = -Infinity // tratamiento o traslado completado
  for (const tr of store.treatmentRuns) {
    if (tr.container_id === container.id && tr.completed_at) closed = Math.max(closed, t(tr.completed_at))
  }
  for (const tf of store.externalTransfers) {
    if (tf.container_id === container.id && tf.transferred_at) closed = Math.max(closed, t(tf.transferred_at))
  }

  const latest = Math.max(cleanDelivered, dirtyReceived, reception, closed)
  if (latest === -Infinity) return 'en_planta'
  if (latest === closed) return 'en_planta'
  if (latest === reception) return 'pendiente_tratar'
  if (latest === dirtyReceived) return 'pendiente_pesar'
  return 'en_cliente'
}

export function computeCirculationBreakdown(store: CirculationStoreSlice): CirculationBreakdown {
  const counts: Record<CirculationBucket, number> = {
    en_planta: 0, en_cliente: 0, pendiente_pesar: 0, pendiente_tratar: 0,
  }
  const activeContainers = store.containers.filter(
    (c) => c.status === 'active' && !c.is_yaris_container,
  )
  for (const container of activeContainers) {
    counts[computeCirculationBucket(container, store)] += 1
  }
  return {
    total: activeContainers.length,
    buckets: BUCKET_DEFINITIONS.map((def) => ({ ...def, count: counts[def.key] })),
  }
}

// ─── Kg del día ─────────────────────────────────────────────────────────────

export interface DailyKgMetrics {
  date: string         // ISO YYYY-MM-DD
  receivedKg: number   // peso neto total recibido (recepciones del día)
  processedKg: number  // peso neto procesado (treatmentRuns completados del día)
  pendingKg: number    // received - processed (mínimo 0)
}

interface DailyKgStoreSlice {
  containers: Container[]
  receptions: ContainerReception[]
  treatmentRuns: TreatmentRun[]
}

function isoDayOf(iso: string): string {
  return iso.slice(0, 10)
}

export function computeDailyKg(store: DailyKgStoreSlice, today: string): DailyKgMetrics {
  const containerMap = new Map(store.containers.map((c) => [c.id, c]))

  let receivedKg = 0
  for (const r of store.receptions) {
    if (r.voided_at) continue
    if (isoDayOf(r.arrived_at) !== today) continue
    const c = containerMap.get(r.container_id)
    if (!c) continue
    receivedKg += computeNetWeight(r.gross_weight_kg, c.tare_weight_kg)
  }

  let processedKg = 0
  for (const t of store.treatmentRuns) {
    if (!t.completed_at) continue
    if (isoDayOf(t.completed_at) !== today) continue
    const c = containerMap.get(t.container_id)
    if (!c) continue
    // Usar la última recepción del container como referencia de peso neto
    // (asumimos un tratamiento por recepción/ciclo).
    const reception = [...store.receptions]
      .filter((r) => r.container_id === c.id && !r.voided_at)
      .sort((a, b) => new Date(b.arrived_at).getTime() - new Date(a.arrived_at).getTime())[0]
    if (!reception) continue
    processedKg += computeNetWeight(reception.gross_weight_kg, c.tare_weight_kg)
  }

  const pendingKg = Math.max(0, receivedKg - processedKg)
  return {
    date: today,
    receivedKg: round2(receivedKg),
    processedKg: round2(processedKg),
    pendingKg: round2(pendingKg),
  }
}

// ─── Kg del mes por empresa ─────────────────────────────────────────────────

export interface MonthlyKgByCompany {
  company_id: string
  company_name: string
  client_id: string
  receivedKg: number
  processedKg: number
}

interface MonthlyKgStoreSlice {
  clients: Client[]
  companies: Company[]
  containers: Container[]
  receptions: ContainerReception[]
  treatmentRuns: TreatmentRun[]
}

/**
 * Calcula recibidos vs procesados por empresa en un rango de mes.
 * `month` formato 'YYYY-MM'.
 */
export function computeMonthlyKgByCompany(
  store: MonthlyKgStoreSlice,
  month: string,
): MonthlyKgByCompany[] {
  const containerMap = new Map(store.containers.map((c) => [c.id, c]))

  const buckets = new Map<string, { receivedKg: number; processedKg: number }>()
  for (const company of store.companies) {
    buckets.set(company.id, { receivedKg: 0, processedKg: 0 })
  }

  // Recibidos: receptions del mes, agrupados por la empresa del REGISTRO de pesaje.
  for (const r of store.receptions) {
    if (r.voided_at) continue
    const day = isoDayOf(r.arrived_at)
    if (!day.startsWith(month)) continue
    const container = containerMap.get(r.container_id)
    if (!container) continue
    const bucket = r.company_id ? buckets.get(r.company_id) : undefined
    if (!bucket) continue
    bucket.receivedKg += computeNetWeight(r.gross_weight_kg, container.tare_weight_kg)
  }

  // Procesados: treatments completados del mes. La empresa se toma de la recepción
  // más reciente del tacho (snapshot del registro), no del tacho.
  for (const t of store.treatmentRuns) {
    if (!t.completed_at) continue
    const day = isoDayOf(t.completed_at)
    if (!day.startsWith(month)) continue
    const container = containerMap.get(t.container_id)
    if (!container) continue
    const reception = [...store.receptions]
      .filter((r) => r.container_id === t.container_id && !r.voided_at)
      .sort((a, b) => new Date(b.arrived_at).getTime() - new Date(a.arrived_at).getTime())[0]
    if (!reception) continue
    const bucket = reception.company_id ? buckets.get(reception.company_id) : undefined
    if (!bucket) continue
    bucket.processedKg += computeNetWeight(reception.gross_weight_kg, container.tare_weight_kg)
  }

  return store.companies
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((company) => {
      const b = buckets.get(company.id) ?? { receivedKg: 0, processedKg: 0 }
      return {
        company_id: company.id,
        company_name: company.name,
        client_id: company.client_id,
        receivedKg: round2(b.receivedKg),
        processedKg: round2(b.processedKg),
      }
    })
}

/** Redondea a 2 decimales para reportar kg sin ruido de coma flotante. */
function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/** Formatea un peso en kg con 2 decimales, ej: "43.70 kg". */
export function formatKg(value: number): string {
  return `${value.toFixed(2)} kg`
}
