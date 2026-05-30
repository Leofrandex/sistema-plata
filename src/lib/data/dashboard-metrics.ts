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
import { computeContainerPhase, computeNetWeight, getRouteEventIdsForContainer } from './containers'

// ─── Circulación de tachos ────────────────────────────────────────────────

export type CirculationBucket =
  | 'en_planta'        // weighing, cold_storage, treatment, transfer
  | 'en_cliente'       // clean (entregado al cliente, listo para sucio)
  | 'en_transito'      // route (recorrido en curso o entre planta y cliente)
  | 'sin_registro'     // sin eventos — recién registrado o "perdido"

export interface CirculationBreakdown {
  total: number
  buckets: Array<{
    key: CirculationBucket
    label: string
    count: number
    color: string
  }>
}

const BUCKET_DEFINITIONS: Array<{ key: CirculationBucket; label: string; color: string }> = [
  { key: 'en_planta',    label: 'En planta',         color: '#2A27E9' }, // accent
  { key: 'en_cliente',   label: 'En cliente',        color: '#10B981' }, // emerald
  { key: 'en_transito',  label: 'Pendiente por pesar', color: '#F59E0B' }, // amber
  { key: 'sin_registro', label: 'Sin registro',      color: '#94A3B8' }, // slate
]

interface CirculationStoreSlice {
  containers: Container[]
  routeEvents: RouteEvent[]
  receptions: ContainerReception[]
  storageEvents: StorageEvent[]
  treatmentRuns: TreatmentRun[]
  externalTransfers: ExternalTransfer[]
  locations: ContainerLocation[]
}

export function computeCirculationBreakdown(store: CirculationStoreSlice): CirculationBreakdown {
  const counts: Record<CirculationBucket, number> = {
    en_planta: 0,
    en_cliente: 0,
    en_transito: 0,
    sin_registro: 0,
  }

  const activeContainers = store.containers.filter((c) => c.status === 'active')

  for (const container of activeContainers) {
    const routeIds = getRouteEventIdsForContainer(store.routeEvents, container.id)
    const reception = [...store.receptions]
      .filter((r) => r.container_id === container.id)
      .sort((a, b) => new Date(b.arrived_at).getTime() - new Date(a.arrived_at).getTime())[0] ?? null
    const storage = [...store.storageEvents]
      .filter((s) => s.container_id === container.id)
      .sort((a, b) => new Date(b.entry_at).getTime() - new Date(a.entry_at).getTime())[0] ?? null
    const treatment = store.treatmentRuns.find((t) => t.container_id === container.id && !t.completed_at)
      ?? store.externalTransfers.find((t) => t.container_id === container.id && !t.transferred_at)
      ?? null

    const phase = computeContainerPhase(routeIds, reception, storage, treatment)

    switch (phase) {
      case 'weighing':
      case 'cold_storage':
      case 'treatment':
      case 'transfer':
        counts.en_planta += 1
        break
      case 'route':
        counts.en_transito += 1
        break
      case 'clean':
        // Buscar última ubicación: si client_site → en_cliente; sino → sin_registro
        {
          const lastLoc = [...store.locations]
            .filter((l) => l.container_id === container.id)
            .sort((a, b) => new Date(b.reported_at).getTime() - new Date(a.reported_at).getTime())[0]
          if (lastLoc?.location_type === 'client_site') counts.en_cliente += 1
          else counts.sin_registro += 1
        }
        break
    }
  }

  return {
    total: activeContainers.length,
    buckets: BUCKET_DEFINITIONS.map((def) => ({
      ...def,
      count: counts[def.key],
    })),
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
      .filter((r) => r.container_id === c.id)
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

  // Recibidos: receptions del mes, agrupados por empresa del container
  for (const r of store.receptions) {
    const day = isoDayOf(r.arrived_at)
    if (!day.startsWith(month)) continue
    const container = containerMap.get(r.container_id)
    if (!container) continue
    const bucket = buckets.get(container.company_id)
    if (!bucket) continue
    bucket.receivedKg += computeNetWeight(r.gross_weight_kg, container.tare_weight_kg)
  }

  // Procesados: treatments completados del mes
  for (const t of store.treatmentRuns) {
    if (!t.completed_at) continue
    const day = isoDayOf(t.completed_at)
    if (!day.startsWith(month)) continue
    const container = containerMap.get(t.container_id)
    if (!container) continue
    const bucket = buckets.get(container.company_id)
    if (!bucket) continue
    const reception = [...store.receptions]
      .filter((r) => r.container_id === t.container_id)
      .sort((a, b) => new Date(b.arrived_at).getTime() - new Date(a.arrived_at).getTime())[0]
    if (!reception) continue
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
