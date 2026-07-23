import type {
  Company,
  Container,
  ContainerReception,
  ExternalTransfer,
  RouteEvent,
  TreatmentRun,
  User,
  WasteType,
  WeighingSession,
} from '@hospiwaste/shared/lib/types'
import { computeNetWeight, deriveContainerCompanyId } from './containers'
import { computeCirculationStatus, type CirculationBucket } from './dashboard-metrics'
import { computeSlotStatus, type SlotStatus } from './route-sessions'
import { ROUTE_SLOTS } from '@hospiwaste/shared/lib/constants'
import type { RouteSlot } from '@hospiwaste/shared/lib/types'

// ─── Utilidades de fecha (días ISO 'YYYY-MM-DD', comparables como string) ────

function isoDayOf(iso: string): string {
  return iso.slice(0, 10)
}

/** Suma `n` días a un día ISO (UTC, sin sorpresas de zona horaria). */
export function addDaysISO(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function inRange(day: string, startDay: string, endDay: string): boolean {
  return day >= startDay && day <= endDay
}

// ─── 1. Kg por tipo de desecho ───────────────────────────────────────────────

export const WASTE_TYPE_LABELS: Record<WasteType | 'unclassified', string> = {
  infectious: 'Peligroso infeccioso',
  anatomopathological: 'Anatomopatológico',
  cytotoxic: 'Citotóxico',
  liquid: 'Líquidos',
  morgue: 'Morgue',
  metallic: 'Metálicos',
  unclassified: 'Sin clasificar',
}

export interface WasteTypeKgBucket {
  type: WasteType | 'unclassified'
  label: string
  kg: number
  pct: number // 0–100, redondeado a 1 decimal
}

interface KgSlice {
  containers: Container[]
  receptions: ContainerReception[]
}

/**
 * Kg netos recibidos por tipo de desecho en un rango de días (inclusive).
 * Recepciones sin `waste_type` (histórico sin backfill) van a 'unclassified'.
 * Solo devuelve buckets con kg > 0, ordenados desc.
 */
export function computeKgByWasteType(
  slice: KgSlice,
  startDay: string,
  endDay: string,
): { buckets: WasteTypeKgBucket[]; totalKg: number } {
  const containerMap = new Map(slice.containers.map((c) => [c.id, c]))
  const sums = new Map<WasteType | 'unclassified', number>()

  for (const r of slice.receptions) {
    if (r.voided_at) continue
    if (!inRange(isoDayOf(r.arrived_at), startDay, endDay)) continue
    const container = containerMap.get(r.container_id)
    if (!container) continue
    const key = r.waste_type ?? 'unclassified'
    sums.set(key, (sums.get(key) ?? 0) + computeNetWeight(r.gross_weight_kg, container.tare_weight_kg))
  }

  const totalKg = round2([...sums.values()].reduce((a, b) => a + b, 0))
  const buckets = [...sums.entries()]
    .map(([type, kg]) => ({
      type,
      label: WASTE_TYPE_LABELS[type],
      kg: round2(kg),
      pct: totalKg > 0 ? Math.round((kg / totalKg) * 1000) / 10 : 0,
    }))
    .filter((b) => b.kg > 0)
    .sort((a, b) => b.kg - a.kg)

  return { buckets, totalKg }
}

// ─── 2. Serie diaria, comparativa mensual, acumulado anual ──────────────────

export interface DailyKgPoint {
  date: string // 'YYYY-MM-DD'
  kg: number
}

/** Kg netos recibidos por día para los últimos `days` días terminando en `endDay`. */
export function computeDailyKgSeries(slice: KgSlice, endDay: string, days: number): DailyKgPoint[] {
  const startDay = addDaysISO(endDay, -(days - 1))
  const containerMap = new Map(slice.containers.map((c) => [c.id, c]))
  const byDay = new Map<string, number>()

  for (const r of slice.receptions) {
    if (r.voided_at) continue
    const day = isoDayOf(r.arrived_at)
    if (!inRange(day, startDay, endDay)) continue
    const container = containerMap.get(r.container_id)
    if (!container) continue
    byDay.set(day, (byDay.get(day) ?? 0) + computeNetWeight(r.gross_weight_kg, container.tare_weight_kg))
  }

  const series: DailyKgPoint[] = []
  for (let i = 0; i < days; i++) {
    const date = addDaysISO(startDay, i)
    series.push({ date, kg: round2(byDay.get(date) ?? 0) })
  }
  return series
}

function monthKg(slice: KgSlice, month: string): number {
  const containerMap = new Map(slice.containers.map((c) => [c.id, c]))
  let total = 0
  for (const r of slice.receptions) {
    if (r.voided_at) continue
    if (!isoDayOf(r.arrived_at).startsWith(month)) continue
    const container = containerMap.get(r.container_id)
    if (!container) continue
    total += computeNetWeight(r.gross_weight_kg, container.tare_weight_kg)
  }
  return round2(total)
}

/** Mes anterior de un 'YYYY-MM'. */
export function previousMonthOf(month: string): string {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 2, 1))
  return d.toISOString().slice(0, 7)
}

export interface MonthComparison {
  month: string
  monthKg: number
  previousMonth: string
  previousMonthKg: number
  /** Variación % vs mes anterior; null si el mes anterior fue 0. */
  deltaPct: number | null
}

export function computeMonthComparison(slice: KgSlice, month: string): MonthComparison {
  const previousMonth = previousMonthOf(month)
  const current = monthKg(slice, month)
  const previous = monthKg(slice, previousMonth)
  return {
    month,
    monthKg: current,
    previousMonth,
    previousMonthKg: previous,
    deltaPct: previous > 0 ? Math.round(((current - previous) / previous) * 1000) / 10 : null,
  }
}

export interface YearAccumulated {
  year: string
  months: Array<{ month: string; kg: number }> // 12 entradas, ene–dic
  totalKg: number
}

/** Kg netos recibidos por mes del año + total acumulado. */
export function computeYearAccumulated(slice: KgSlice, year: string): YearAccumulated {
  const months = Array.from({ length: 12 }, (_, i) => {
    const month = `${year}-${String(i + 1).padStart(2, '0')}`
    return { month, kg: monthKg(slice, month) }
  })
  return { year, months, totalKg: round2(months.reduce((a, m) => a + m.kg, 0)) }
}

/** Peso neto promedio por recepción en el rango; null si no hubo recepciones. */
export function computeAvgWeightPerContainer(
  slice: KgSlice,
  startDay: string,
  endDay: string,
): number | null {
  const containerMap = new Map(slice.containers.map((c) => [c.id, c]))
  let total = 0
  let count = 0
  for (const r of slice.receptions) {
    if (r.voided_at) continue
    if (!inRange(isoDayOf(r.arrived_at), startDay, endDay)) continue
    const container = containerMap.get(r.container_id)
    if (!container) continue
    total += computeNetWeight(r.gross_weight_kg, container.tare_weight_kg)
    count += 1
  }
  return count > 0 ? round2(total / count) : null
}

// ─── 3. Tachos estancados ────────────────────────────────────────────────────

export interface StagnantContainer {
  id: string
  bucket: CirculationBucket
  sinceMs: number
  durationMs: number
}

interface CirculationSlice {
  containers: Container[]
  routeEvents: RouteEvent[]
  receptions: ContainerReception[]
  treatmentRuns: TreatmentRun[]
  externalTransfers: ExternalTransfer[]
}

/**
 * Top-N de tachos activos con más tiempo en su estado actual, excluyendo
 * 'en_planta' (un tacho limpio esperando en planta no es un problema).
 */
export function computeStagnantContainers(
  slice: CirculationSlice,
  nowMs: number,
  topN = 5,
): StagnantContainer[] {
  const rows: StagnantContainer[] = []
  for (const container of slice.containers) {
    if (container.status !== 'active' || container.is_yaris_container) continue
    const { bucket, sinceMs } = computeCirculationStatus(container, slice)
    if (bucket === 'en_planta' || sinceMs === null) continue
    rows.push({ id: container.id, bucket, sinceMs, durationMs: nowMs - sinceMs })
  }
  return rows.sort((a, b) => b.durationMs - a.durationMs).slice(0, topN)
}

// ─── 4. Recorridos: cumplimiento de slots y estadísticas ────────────────────

export interface SlotComplianceEntry {
  slot: RouteSlot
  shortLabel: string
  status: SlotStatus
}

export interface SlotCompliance {
  slots: SlotComplianceEntry[]
  completed: number
  total: number
}

/** Estado de los 6 horarios fijos de andén para un día. */
export function computeSlotComplianceToday(routeEvents: RouteEvent[], day: string): SlotCompliance {
  const slots = ROUTE_SLOTS.map((def) => ({
    slot: def.id,
    shortLabel: def.shortLabel,
    status: computeSlotStatus(routeEvents, day, def.id, null).status,
  }))
  return {
    slots,
    completed: slots.filter((s) => s.status === 'completed').length,
    total: slots.length,
  }
}

export interface RouteStats {
  /** Recorridos (no anulados) de los últimos 7 días terminando en `today`. */
  last7Count: number
  /** Recorridos de los 7 días anteriores a esos. */
  prev7Count: number
  anden7: number
  morgue7: number
  /** Promedio de tachos sucios recogidos por recorrido (últimos 7 días). */
  avgDirtyPerRoute: number | null
  /** Promedio de tachos limpios entregados por recorrido (últimos 7 días). */
  avgCleanPerRoute: number | null
}

export function computeRouteStats(routeEvents: RouteEvent[], today: string): RouteStats {
  const last7Start = addDaysISO(today, -6)
  const prev7Start = addDaysISO(today, -13)
  const prev7End = addDaysISO(today, -7)

  const valid = routeEvents.filter((r) => !r.voided_at)
  const last7 = valid.filter((r) => inRange(r.date, last7Start, today))
  const prev7 = valid.filter((r) => inRange(r.date, prev7Start, prev7End))

  const dirtyTotal = last7.reduce((a, r) => a + r.containers_dirty_received.length, 0)
  const cleanTotal = last7.reduce((a, r) => a + r.containers_clean_delivered.length, 0)

  return {
    last7Count: last7.length,
    prev7Count: prev7.length,
    anden7: last7.filter((r) => r.kind === 'anden').length,
    morgue7: last7.filter((r) => r.kind === 'morgue').length,
    avgDirtyPerRoute: last7.length > 0 ? round2(dirtyTotal / last7.length) : null,
    avgCleanPerRoute: last7.length > 0 ? round2(cleanTotal / last7.length) : null,
  }
}

// ─── 5. Actividad por operador ───────────────────────────────────────────────

export interface OperatorActivityRow {
  operatorId: string
  name: string
  routes: number
  weighings: number
  treatments: number
  total: number
}

interface OperatorSlice {
  users: User[]
  routeEvents: RouteEvent[]
  receptions: ContainerReception[]
  treatmentRuns: TreatmentRun[]
}

/** Conteo de registros por operador en un rango de días (inclusive). */
export function computeOperatorActivity(
  slice: OperatorSlice,
  startDay: string,
  endDay: string,
): OperatorActivityRow[] {
  const counts = new Map<string, { routes: number; weighings: number; treatments: number }>()
  const bump = (id: string, key: 'routes' | 'weighings' | 'treatments') => {
    const row = counts.get(id) ?? { routes: 0, weighings: 0, treatments: 0 }
    row[key] += 1
    counts.set(id, row)
  }

  for (const r of slice.routeEvents) {
    if (r.voided_at) continue
    if (inRange(r.date, startDay, endDay)) bump(r.operator_id, 'routes')
  }
  for (const r of slice.receptions) {
    if (r.voided_at) continue
    if (inRange(isoDayOf(r.arrived_at), startDay, endDay)) bump(r.operator_id, 'weighings')
  }
  for (const t of slice.treatmentRuns) {
    if (!t.completed_at) continue
    if (inRange(isoDayOf(t.completed_at), startDay, endDay)) bump(t.operator_id, 'treatments')
  }

  const nameOf = new Map(slice.users.map((u) => [u.id, u.name]))
  return [...counts.entries()]
    .map(([operatorId, c]) => ({
      operatorId,
      name: nameOf.get(operatorId) ?? operatorId,
      ...c,
      total: c.routes + c.weighings + c.treatments,
    }))
    .sort((a, b) => b.total - a.total)
}

// ─── 6. Calidad y trazabilidad ───────────────────────────────────────────────

export interface ObservationEntry {
  receptionId: string
  containerId: string
  arrivedAt: string
  observations: string
}

export interface VoidedEntry {
  kind: 'recorrido' | 'pesaje' | 'sesión de pesaje'
  id: string
  voidedAt: string
  reason: string
}

export interface QualityIndicators {
  observations: ObservationEntry[]
  voided: VoidedEntry[]
  routesWithoutSignature: number
  routesWithoutPhotos: number
  /** Total de recorridos completados (no anulados) considerados en la ventana. */
  routesConsidered: number
}

interface QualitySlice {
  routeEvents: RouteEvent[]
  receptions: ContainerReception[]
  weighingSessions: WeighingSession[]
}

/**
 * Indicadores de calidad del registro desde `sinceDay` (inclusive): últimas
 * observaciones de pesaje, anulaciones con motivo, y recorridos sin firma o
 * sin memoria fotográfica (las fotos son opcionales desde 2026-07-08).
 */
export function computeQualityIndicators(
  slice: QualitySlice,
  sinceDay: string,
  limit = 8,
): QualityIndicators {
  const observations = slice.receptions
    .filter((r) => !r.voided_at && r.observations.trim() !== '' && isoDayOf(r.arrived_at) >= sinceDay)
    .sort((a, b) => b.arrived_at.localeCompare(a.arrived_at))
    .slice(0, limit)
    .map((r) => ({
      receptionId: r.id,
      containerId: r.container_id,
      arrivedAt: r.arrived_at,
      observations: r.observations,
    }))

  const voided: VoidedEntry[] = []
  for (const r of slice.routeEvents) {
    if (r.voided_at && isoDayOf(r.voided_at) >= sinceDay) {
      voided.push({ kind: 'recorrido', id: r.id, voidedAt: r.voided_at, reason: r.void_reason ?? '' })
    }
  }
  for (const r of slice.receptions) {
    if (r.voided_at && isoDayOf(r.voided_at) >= sinceDay) {
      voided.push({ kind: 'pesaje', id: r.id, voidedAt: r.voided_at, reason: r.void_reason ?? '' })
    }
  }
  for (const s of slice.weighingSessions) {
    if (s.voided_at && isoDayOf(s.voided_at) >= sinceDay) {
      voided.push({ kind: 'sesión de pesaje', id: s.id, voidedAt: s.voided_at, reason: s.void_reason ?? '' })
    }
  }
  voided.sort((a, b) => b.voidedAt.localeCompare(a.voidedAt))

  const routesInWindow = slice.routeEvents.filter(
    (r) => !r.voided_at && r.status === 'completed' && r.date >= sinceDay,
  )
  const routesWithoutSignature = routesInWindow.filter((r) => !r.signature_photo_id).length
  const routesWithoutPhotos = routesInWindow.filter(
    (r) => (r.dirty_photo_ids ?? []).length === 0 && (r.clean_photo_ids ?? []).length === 0,
  ).length

  return {
    observations,
    voided: voided.slice(0, limit),
    routesWithoutSignature,
    routesWithoutPhotos,
    routesConsidered: routesInWindow.length,
  }
}

// ─── 7. Flota y operaciones de planta ────────────────────────────────────────

export interface FleetBreakdown {
  activeCount: number
  decommissionedCount: number
  bySize: Array<{ size: number; count: number }>
  byCompany: Array<{ companyId: string | null; companyName: string; count: number }>
  treatmentsCompleted7: number
  avgTreatmentDurationMs: number | null
  transfersPending: number
  transfersCompleted: number
}

interface FleetSlice {
  companies: Company[]
  containers: Container[]
  routeEvents: RouteEvent[]
  receptions: ContainerReception[]
  treatmentRuns: TreatmentRun[]
  externalTransfers: ExternalTransfer[]
}

export function computeFleetBreakdown(slice: FleetSlice, today: string): FleetBreakdown {
  const pool = slice.containers.filter((c) => !c.is_yaris_container)
  const active = pool.filter((c) => c.status === 'active')

  const sizeCounts = new Map<number, number>()
  for (const c of active) sizeCounts.set(c.size_liters, (sizeCounts.get(c.size_liters) ?? 0) + 1)

  const companyName = new Map(slice.companies.map((c) => [c.id, c.name]))
  const companyCounts = new Map<string | null, number>()
  for (const c of active) {
    const companyId = deriveContainerCompanyId(c.id, slice.routeEvents, slice.receptions)
    companyCounts.set(companyId, (companyCounts.get(companyId) ?? 0) + 1)
  }

  const last7Start = addDaysISO(today, -6)
  let treatmentsCompleted7 = 0
  let durationTotal = 0
  let durationCount = 0
  for (const t of slice.treatmentRuns) {
    if (!t.completed_at) continue
    const day = isoDayOf(t.completed_at)
    if (inRange(day, last7Start, today)) treatmentsCompleted7 += 1
    const duration = new Date(t.completed_at).getTime() - new Date(t.started_at).getTime()
    if (duration > 0) {
      durationTotal += duration
      durationCount += 1
    }
  }

  return {
    activeCount: active.length,
    decommissionedCount: pool.length - active.length,
    bySize: [...sizeCounts.entries()]
      .map(([size, count]) => ({ size, count }))
      .sort((a, b) => a.size - b.size),
    byCompany: [...companyCounts.entries()]
      .map(([companyId, count]) => ({
        companyId,
        companyName: companyId ? companyName.get(companyId) ?? companyId : 'Sin empresa',
        count,
      }))
      .sort((a, b) => b.count - a.count),
    treatmentsCompleted7,
    avgTreatmentDurationMs: durationCount > 0 ? Math.round(durationTotal / durationCount) : null,
    transfersPending: slice.externalTransfers.filter((t) => t.transferred_at === null).length,
    transfersCompleted: slice.externalTransfers.filter((t) => t.transferred_at !== null).length,
  }
}
