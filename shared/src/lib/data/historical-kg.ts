import type { Company, Container, ContainerReception } from '@hospiwaste/shared/lib/types'
import type { HistoricalDailyKgRow } from '@hospiwaste/shared/lib/supabase/queries/historical-kg'
import { computeNetWeight } from './containers'

/**
 * Serie unica de kilos por dia y empresa, uniendo las dos fuentes:
 *
 *   `historico`  agregado diario del Excel de planta   2024-01-15 -> 2026-09-06
 *   `sistema`    recepciones registradas en la app     2026-09-07 -> hoy
 *
 * No se solapan (ver el ADR `2026-09-14-historico-kilos-2024-2026`), asi que
 * concatenarlas no duplica nada. Todo lo demas de este modulo -- totales por
 * mes, comparativos ano contra ano, reportes por rango -- se calcula sobre
 * esta serie, para que el corte entre fuentes no se note en ningun numero.
 */
export interface DailyKgEntry {
  /** Dia ISO 'YYYY-MM-DD'. */
  date: string
  companyId: string | null
  companyName: string
  kg: number
  /** Cantidad de pesajes individuales detras de `kg`. */
  records: number
  source: 'historico' | 'sistema'
}

/**
 * Primer dia que el sistema en vivo registra pesajes reales. Todo lo anterior
 * vive en `historical_daily_kg`. Ver el ADR `2026-09-14-historico-kilos-2024-2026`.
 *
 * Vive en la capa de datos y no en la de queries porque es una regla del
 * dominio -- donde termina una fuente y empieza la otra -- y las funciones de
 * este modulo la necesitan para no contar nada dos veces.
 */
export const HISTORICAL_CUTOVER = '2026-09-07'

/** Mes del corte: tiene dias de las dos fuentes y hay que unirlas. */
export const HISTORICAL_CUTOVER_MONTH = HISTORICAL_CUTOVER.slice(0, 7)

/** Mes (YYYY-MM) mas viejo con historico cargado. */
export const HISTORICAL_FIRST_MONTH = '2024-01'

const SIN_EMPRESA = 'Sin especificar'

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/** Mes 'YYYY-MM' de un dia ISO. */
export function monthOf(day: string): string {
  return day.slice(0, 7)
}

/** Ano 'YYYY' de un dia ISO. */
export function yearOf(day: string): string {
  return day.slice(0, 4)
}

// ─── Construccion de la serie unificada ──────────────────────────────────────

interface LiveSlice {
  companies: Company[]
  containers: Container[]
  receptions: ContainerReception[]
}

/**
 * Recepciones vigentes del sistema -> entradas diarias por empresa.
 *
 * Descarta lo anterior al corte. Que hoy no exista ninguna recepcion previa al
 * 2026-09-07 es una propiedad de los datos, no una garantia: las 36 de prueba
 * que se borraron siguen archivadas en `_archivo_receptions_pre_2026_09_07`, y
 * restaurar un backup viejo bastaria para que esos dias se cuenten dos veces
 * -- una desde aca y otra desde el historico -- sin que nada avise. El filtro
 * hace que el invariante lo sostenga el codigo.
 */
export function dailyKgFromLive(store: LiveSlice): DailyKgEntry[] {
  const containerById = new Map(store.containers.map((c) => [c.id, c]))
  const companyById = new Map(store.companies.map((c) => [c.id, c]))

  const acc = new Map<string, DailyKgEntry>()
  for (const r of store.receptions) {
    if (r.voided_at) continue
    const container = containerById.get(r.container_id)
    if (!container) continue

    const date = r.arrived_at.slice(0, 10)
    if (date < HISTORICAL_CUTOVER) continue
    const companyId = r.company_id ?? null
    const companyName = companyId ? (companyById.get(companyId)?.name ?? companyId) : SIN_EMPRESA
    const key = `${date}|${companyName}`

    const entry = acc.get(key)
    const kg = computeNetWeight(r.gross_weight_kg, container.tare_weight_kg)
    if (entry) {
      entry.kg += kg
      entry.records += 1
    } else {
      acc.set(key, { date, companyId, companyName, kg, records: 1, source: 'sistema' })
    }
  }

  for (const entry of acc.values()) entry.kg = round2(entry.kg)
  return [...acc.values()].sort((a, b) => a.date.localeCompare(b.date))
}

/** Filas de `historical_daily_kg` -> entradas diarias. */
export function dailyKgFromHistorical(rows: HistoricalDailyKgRow[]): DailyKgEntry[] {
  return rows
    .filter((r) => r.received_records > 0)
    .map((r) => ({
      date: r.weighed_on,
      companyId: r.company_id,
      companyName: r.company_name,
      kg: Number(r.received_kg),
      records: r.received_records,
      source: 'historico' as const,
    }))
}

/** Une historico + sistema en una sola serie ordenada por fecha. */
export function unifiedDailyKg(
  historical: HistoricalDailyKgRow[],
  live: LiveSlice,
): DailyKgEntry[] {
  return [...dailyKgFromHistorical(historical), ...dailyKgFromLive(live)].sort((a, b) =>
    a.date.localeCompare(b.date),
  )
}

// ─── Rollups ─────────────────────────────────────────────────────────────────

export interface KgTotals {
  kg: number
  records: number
  /** Dias distintos con al menos un pesaje. */
  days: number
}

function emptyTotals(): KgTotals {
  return { kg: 0, records: 0, days: 0 }
}

function accumulate(
  into: Map<string, KgTotals & { _days: Set<string> }>,
  key: string,
  entry: DailyKgEntry,
): void {
  let bucket = into.get(key)
  if (!bucket) {
    bucket = { ...emptyTotals(), _days: new Set<string>() }
    into.set(key, bucket)
  }
  bucket.kg += entry.kg
  bucket.records += entry.records
  bucket._days.add(entry.date)
}

function seal(into: Map<string, KgTotals & { _days: Set<string> }>): Map<string, KgTotals> {
  const out = new Map<string, KgTotals>()
  for (const [key, b] of into) {
    out.set(key, { kg: round2(b.kg), records: b.records, days: b._days.size })
  }
  return out
}

/** Totales por mes 'YYYY-MM'. */
export function rollupByMonth(entries: DailyKgEntry[]): Map<string, KgTotals> {
  const acc = new Map<string, KgTotals & { _days: Set<string> }>()
  for (const e of entries) accumulate(acc, monthOf(e.date), e)
  return seal(acc)
}

/** Totales por ano 'YYYY'. */
export function rollupByYear(entries: DailyKgEntry[]): Map<string, KgTotals> {
  const acc = new Map<string, KgTotals & { _days: Set<string> }>()
  for (const e of entries) accumulate(acc, yearOf(e.date), e)
  return seal(acc)
}

/** Totales por empresa. */
export function rollupByCompany(entries: DailyKgEntry[]): Map<string, KgTotals> {
  const acc = new Map<string, KgTotals & { _days: Set<string> }>()
  for (const e of entries) accumulate(acc, e.companyName, e)
  return seal(acc)
}

/** Recorta la serie a un rango de dias inclusivo. */
export function inRange(entries: DailyKgEntry[], from: string, to: string): DailyKgEntry[] {
  return entries.filter((e) => e.date >= from && e.date <= to)
}

// ─── Mes historico con la forma que espera el grafico de barras ──────────────

/**
 * Misma forma que `MonthlyKgByCompany` de `dashboard-metrics`, para que el
 * grafico mensual del dashboard pueda pintar un mes historico sin cambiar de
 * componente.
 *
 * `processedKg` va siempre en 0 a proposito: la columna `Fecha de Tratado` del
 * Excel es opcional y su cobertura oscila entre 42% y 84% segun el ano, asi que
 * un "procesado" historico no es comparable contra el recibido y mostrarlo
 * sugeriria una merma que no existe. Quien pinta el mes debe ocultar esa serie
 * (ver la prop `showProcessed` del grafico).
 */
export interface HistoricalMonthByCompany {
  company_id: string
  company_name: string
  client_id: string
  receivedKg: number
  processedKg: number
}

export function historicalMonthlyKgByCompany(
  rows: HistoricalDailyKgRow[],
  month: string,
): HistoricalMonthByCompany[] {
  const acc = new Map<string, HistoricalMonthByCompany>()

  for (const row of rows) {
    if (monthOf(row.weighed_on) !== month) continue
    if (row.received_records === 0) continue

    const key = row.company_name
    const bucket = acc.get(key)
    if (bucket) {
      bucket.receivedKg += Number(row.received_kg)
    } else {
      acc.set(key, {
        company_id: row.company_id ?? `historico:${row.company_name}`,
        company_name: row.company_name,
        client_id: '',
        receivedKg: Number(row.received_kg),
        processedKg: 0,
      })
    }
  }

  return [...acc.values()]
    .map((b) => ({ ...b, receivedKg: round2(b.receivedKg) }))
    .sort((a, b) => b.receivedKg - a.receivedKg)
}

/** Un id inventado por el historico, no una empresa real del sistema. */
function esIdInventado(companyId: string): boolean {
  return companyId.startsWith('historico:')
}

/**
 * Suma el mes del corte, que tiene dias de las dos fuentes.
 *
 * Septiembre 2026 empieza en el historico (1 al 6) y termina en el sistema
 * (7 en adelante). Elegir una sola fuente para ese mes deja afuera la mitad:
 * sin esto la barra mensual mostraba 19,180 kg mientras el comparativo anual
 * -- que si une las dos -- mostraba 32,163 kg para el MISMO mes, en la misma
 * pantalla.
 *
 * Se agrupa por nombre de empresa porque es lo unico que ambas fuentes
 * comparten: el historico no tiene los ids del sistema.
 */
export function mergeMonthlyByCompany(
  historical: HistoricalMonthByCompany[],
  live: HistoricalMonthByCompany[],
): HistoricalMonthByCompany[] {
  const acc = new Map<string, HistoricalMonthByCompany>()

  for (const fila of [...historical, ...live]) {
    const previo = acc.get(fila.company_name)
    if (!previo) {
      acc.set(fila.company_name, { ...fila })
      continue
    }
    previo.receivedKg += fila.receivedKg
    previo.processedKg += fila.processedKg
    // Si una de las dos trae la empresa real del sistema, esa gana.
    if (esIdInventado(previo.company_id) && !esIdInventado(fila.company_id)) {
      previo.company_id = fila.company_id
      previo.client_id = fila.client_id
    }
  }

  return [...acc.values()]
    .map((b) => ({
      ...b,
      receivedKg: round2(b.receivedKg),
      processedKg: round2(b.processedKg),
    }))
    .sort((a, b) => b.receivedKg - a.receivedKg)
}

// ─── Comparativo ano contra ano ──────────────────────────────────────────────

export interface YearMonthlySeries {
  year: string
  /** 12 posiciones, enero..diciembre. `null` = el mes no tiene datos. */
  months: Array<number | null>
  totalKg: number
  totalRecords: number
}

/**
 * Una fila por ano con sus 12 totales mensuales. Los meses sin datos quedan en
 * `null` (no en 0) para que el grafico corte la linea en vez de desplomarla:
 * un ano en curso no debe dibujar una caida a cero en los meses que todavia no
 * ocurrieron.
 */
export function yearlyMonthlySeries(entries: DailyKgEntry[]): YearMonthlySeries[] {
  const byYear = new Map<string, { months: Array<number | null>; records: number }>()

  for (const e of entries) {
    const year = yearOf(e.date)
    let row = byYear.get(year)
    if (!row) {
      row = { months: Array.from({ length: 12 }, () => null), records: 0 }
      byYear.set(year, row)
    }
    const idx = Number(e.date.slice(5, 7)) - 1
    row.months[idx] = (row.months[idx] ?? 0) + e.kg
    row.records += e.records
  }

  return [...byYear.entries()]
    .map(([year, row]) => ({
      year,
      months: row.months.map((m) => (m === null ? null : round2(m))),
      totalKg: round2(row.months.reduce<number>((sum, m) => sum + (m ?? 0), 0)),
      totalRecords: row.records,
    }))
    .sort((a, b) => a.year.localeCompare(b.year))
}

/**
 * Forma lista para Recharts: un punto por mes con una clave por ano.
 *
 *   [{ month: 'Ene', monthIndex: 0, '2024': 10219.4, '2025': 32006.7, ... }, ...]
 */
export interface MonthlyComparisonPoint {
  month: string
  monthIndex: number
  [year: string]: string | number | null
}

/** Etiquetas cortas de mes, en el orden en que salen de `monthlyComparisonPoints`. */
export const MONTH_LABELS = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
  'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic',
] as const

export function monthlyComparisonPoints(series: YearMonthlySeries[]): MonthlyComparisonPoint[] {
  return MONTH_LABELS.map((month, monthIndex) => {
    const point: MonthlyComparisonPoint = { month, monthIndex }
    for (const s of series) point[s.year] = s.months[monthIndex]
    return point
  })
}

// ─── Comparativo de un periodo contra el mismo periodo del ano anterior ──────

export interface PeriodComparison {
  from: string
  to: string
  current: KgTotals
  /** Mismo rango de dias, un ano antes. `null` si no hay datos para ese rango. */
  previous: KgTotals | null
  /** Variacion porcentual de kg contra el periodo anterior. `null` si no aplica. */
  deltaPct: number | null
  /** Promedio de kg por dia con actividad. */
  avgKgPerDay: number | null
  /** Promedio de kg por pesaje. */
  avgKgPerRecord: number | null
}

function shiftYear(day: string, delta: number): string {
  const [y, rest] = [day.slice(0, 4), day.slice(4)]
  return `${Number(y) + delta}${rest}`
}

function totalsOf(entries: DailyKgEntry[]): KgTotals {
  const days = new Set<string>()
  let kg = 0
  let records = 0
  for (const e of entries) {
    kg += e.kg
    records += e.records
    days.add(e.date)
  }
  return { kg: round2(kg), records, days: days.size }
}

export function comparePeriod(
  entries: DailyKgEntry[],
  from: string,
  to: string,
): PeriodComparison {
  const current = totalsOf(inRange(entries, from, to))
  const prevEntries = inRange(entries, shiftYear(from, -1), shiftYear(to, -1))
  const previous = prevEntries.length > 0 ? totalsOf(prevEntries) : null

  return {
    from,
    to,
    current,
    previous,
    deltaPct:
      previous && previous.kg > 0
        ? Math.round(((current.kg - previous.kg) / previous.kg) * 1000) / 10
        : null,
    avgKgPerDay: current.days > 0 ? round2(current.kg / current.days) : null,
    avgKgPerRecord: current.records > 0 ? round2(current.kg / current.records) : null,
  }
}
