import {
  comparePeriod,
  inRange,
  rollupByCompany,
  rollupByMonth,
  yearlyMonthlySeries,
  type DailyKgEntry,
  type PeriodComparison,
  type YearMonthlySeries,
} from '@hospiwaste/shared/lib/data/historical-kg'

export interface CompanyShare {
  name: string
  kg: number
  records: number
  /** Participación sobre el total del período, 0–100. */
  sharePct: number
}

export interface MonthRow {
  /** 'YYYY-MM' */
  month: string
  kg: number
  records: number
  /** Mismo mes del año anterior. `null` si no hay dato. */
  previousKg: number | null
  deltaPct: number | null
}

export interface KgComparisonReportData {
  from: string
  to: string
  comparison: PeriodComparison
  years: YearMonthlySeries[]
  months: MonthRow[]
  byCompany: CompanyShare[]
  generatedAt: string
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function previousYearMonth(month: string): string {
  return `${Number(month.slice(0, 4)) - 1}${month.slice(4)}`
}

/**
 * Arma el reporte de kilos de un rango, con su comparación contra el mismo
 * rango del año anterior.
 *
 * `entries` debe ser la serie unificada (histórico + sistema) COMPLETA, no
 * recortada: la comparación interanual necesita poder mirar hacia atrás fuera
 * del rango que se está reportando.
 */
export function buildKgComparisonReport(
  entries: DailyKgEntry[],
  from: string,
  to: string,
  now = new Date(),
): KgComparisonReportData {
  const window = inRange(entries, from, to)

  const monthly = rollupByMonth(window)
  const allMonthly = rollupByMonth(entries)

  const months: MonthRow[] = [...monthly.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, totals]) => {
      const prev = allMonthly.get(previousYearMonth(month))
      const previousKg = prev ? prev.kg : null
      return {
        month,
        kg: totals.kg,
        records: totals.records,
        previousKg,
        deltaPct:
          previousKg && previousKg > 0
            ? Math.round(((totals.kg - previousKg) / previousKg) * 1000) / 10
            : null,
      }
    })

  const companyTotals = rollupByCompany(window)
  const totalKg = [...companyTotals.values()].reduce((sum, t) => sum + t.kg, 0)
  const byCompany: CompanyShare[] = [...companyTotals.entries()]
    .map(([name, t]) => ({
      name,
      kg: t.kg,
      records: t.records,
      sharePct: totalKg > 0 ? round2((t.kg / totalKg) * 100) : 0,
    }))
    .sort((a, b) => b.kg - a.kg)

  return {
    from,
    to,
    comparison: comparePeriod(entries, from, to),
    years: yearlyMonthlySeries(entries),
    months,
    byCompany,
    generatedAt: now.toISOString(),
  }
}
