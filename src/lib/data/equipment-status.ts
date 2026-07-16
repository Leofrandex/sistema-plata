/**
 * Lógica pura del semáforo de mantenimiento preventivo de equipos.
 * Fechas como strings 'YYYY-MM-DD' comparadas en UTC (sin off-by-one por TZ).
 */

export type MaintenanceState = 'unconfigured' | 'ok' | 'due_soon' | 'overdue'

export interface MaintenanceStatus {
  state: MaintenanceState
  lastPerformedAt: string | null
  nextDueAt: string | null
  daysRemaining: number | null
}

export const DUE_SOON_THRESHOLD_DAYS = 15

const MS_PER_DAY = 86_400_000

function toUtcMs(isoDate: string): number {
  const [y, m, d] = isoDate.split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}

function fromUtcMs(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10)
}

/** Fecha local de hoy como 'YYYY-MM-DD' (en-CA formatea exactamente así). */
export function todayISO(): string {
  return new Date().toLocaleDateString('en-CA')
}

export function computeMaintenanceStatus(args: {
  frequencyDays: number | null
  lastPerformedAt: string | null
  today: string
}): MaintenanceStatus {
  const { frequencyDays, lastPerformedAt, today } = args
  if (frequencyDays === null || lastPerformedAt === null) {
    return { state: 'unconfigured', lastPerformedAt, nextDueAt: null, daysRemaining: null }
  }
  const nextMs = toUtcMs(lastPerformedAt) + frequencyDays * MS_PER_DAY
  const daysRemaining = Math.round((nextMs - toUtcMs(today)) / MS_PER_DAY)
  const state: MaintenanceState =
    daysRemaining < 0 ? 'overdue' : daysRemaining <= DUE_SOON_THRESHOLD_DAYS ? 'due_soon' : 'ok'
  return { state, lastPerformedAt, nextDueAt: fromUtcMs(nextMs), daysRemaining }
}

/** Última fecha de mantenimiento no anulado, o null. */
export function latestMaintenanceDate(
  maintenances: { performed_at: string; voided_at: string | null }[]
): string | null {
  let latest: string | null = null
  for (const m of maintenances) {
    if (m.voided_at) continue
    if (!latest || m.performed_at > latest) latest = m.performed_at
  }
  return latest
}

/** Orden: vencidos primero (más vencido arriba), luego días ascendente, grises al final. */
export function compareByUrgency(a: MaintenanceStatus, b: MaintenanceStatus): number {
  const key = (s: MaintenanceStatus) => (s.daysRemaining === null ? Infinity : s.daysRemaining)
  return key(a) - key(b)
}

export function formatDaysRemaining(status: MaintenanceStatus): string {
  const d = status.daysRemaining
  if (d === null) return '—'
  if (d === 0) return 'Vence hoy'
  if (d < 0) return `Vencido hace ${-d} ${-d === 1 ? 'día' : 'días'}`
  return `${d} ${d === 1 ? 'día' : 'días'}`
}
