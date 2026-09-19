'use client'

import { useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import {
  Download,
  Loader2,
  Minus,
  TrendingDown,
  TrendingUp,
} from 'lucide-react'
import { Card, CardContent } from '@hospiwaste/shared/components/ui/card'
import { Button } from '@hospiwaste/shared/components/ui/button'
import { APP_NAME } from '@hospiwaste/shared/lib/constants'
import { cn } from '@hospiwaste/shared/lib/utils'
import { useStore } from '@hospiwaste/shared/lib/store'
import { computeMonthlyKgByCompany } from '@hospiwaste/shared/lib/data/dashboard-metrics'
import {
  HISTORICAL_CUTOVER_MONTH,
  HISTORICAL_FIRST_MONTH,
  historicalMonthlyKgByCompany,
  mergeMonthlyByCompany,
  unifiedDailyKg,
  yearlyMonthlySeries,
} from '@hospiwaste/shared/lib/data/historical-kg'
import { useHistoricalKg } from '@/hooks/use-historical-kg'
import { buildKgComparisonReport } from '@/lib/data/kg-comparison-report'
import { KgComparisonDocument } from '@/components/reports/kg-comparison-document'
import { YearComparisonSection } from '@/components/dashboard/year-comparison-section'
import { MonthlyBarChart } from '@/components/dashboard/monthly-bar-chart'
import { DateRangeToolbar, type RangePreset } from '@/components/analytics/date-range-toolbar'

const PDFDownloadLink = dynamic(
  () => import('@react-pdf/renderer').then((mod) => mod.PDFDownloadLink),
  { ssr: false },
)

const NUM = new Intl.NumberFormat('es-PA', { maximumFractionDigits: 0 })
const NUM1 = new Intl.NumberFormat('es-PA', { maximumFractionDigits: 1 })

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

function kgLabel(value: number): string {
  return `${NUM.format(value)} kg`
}

function toneladas(value: number): string {
  return `${NUM1.format(value / 1000)} t`
}

function pctLabel(value: number | null): string {
  if (value === null) return '—'
  return `${value > 0 ? '+' : ''}${NUM1.format(value)}%`
}

function mesLargo(month: string): string {
  return `${MESES[Number(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}`
}

function todayISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function AnalyticsPage() {
  const { clients, companies, containers, receptions, treatmentRuns } = useStore()
  const { rows: historicalRows, loading, error } = useHistoricalKg()

  const today = useMemo(todayISO, [])
  const currentYear = today.slice(0, 4)
  const currentMonth = today.slice(0, 7)

  // Rango por defecto: año en curso
  const [from, setFrom] = useState(`${currentYear}-01-01`)
  const [to, setTo] = useState(today)

  // Mes que se está mirando en el gráfico por empresa. Acá sí navega hasta
  // 2024: esta página carga el histórico, el dashboard no.
  const [month, setMonth] = useState(currentMonth)

  const invalidRange = from > to

  const entries = useMemo(
    () => unifiedDailyKg(historicalRows, { companies, containers, receptions }),
    [historicalRows, companies, containers, receptions],
  )

  const yearSeries = useMemo(
    () => yearlyMonthlySeries(entries),
    [entries],
  )

  // De dónde sale el mes que se está mirando. El mes del corte tiene días de
  // las dos fuentes (sep-2026: histórico del 1 al 6, sistema del 7 en adelante)
  // y hay que sumarlas: elegir una sola dejaba afuera la mitad del mes.
  const monthSource: 'historico' | 'mixto' | 'sistema' =
    month < HISTORICAL_CUTOVER_MONTH
      ? 'historico'
      : month === HISTORICAL_CUTOVER_MONTH
        ? 'mixto'
        : 'sistema'

  const monthlyKg = useMemo(() => {
    if (monthSource === 'historico') return historicalMonthlyKgByCompany(historicalRows, month)

    const live = computeMonthlyKgByCompany(
      { clients, companies, containers, receptions, treatmentRuns },
      month,
    )
    if (monthSource === 'sistema') return live

    return mergeMonthlyByCompany(historicalMonthlyKgByCompany(historicalRows, month), live)
  }, [monthSource, historicalRows, clients, companies, containers, receptions, treatmentRuns, month])

  const report = useMemo(
    () => (invalidRange || entries.length === 0 ? null : buildKgComparisonReport(entries, from, to)),
    [entries, from, to, invalidRange],
  )

  const filename = `${APP_NAME}_ReporteAnalitico_${from}_${to}.pdf`

  // El rango de cada atajo se define en un solo lugar: así el resaltado no se
  // puede desincronizar de lo que el botón realmente aplica. Antes "Últimos
  // 12m" nunca se prendía porque su comparación no existía.
  const presetRanges = useMemo((): Record<RangePreset, { from: string; to: string }> => {
    const d = new Date()
    d.setFullYear(d.getFullYear() - 1)
    const oneYearAgo = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    return {
      ytd: { from: `${currentYear}-01-01`, to: today },
      '12m': { from: oneYearAgo, to: today },
      all: { from: `${HISTORICAL_FIRST_MONTH}-15`, to: today },
    }
  }, [currentYear, today])

  function setPreset(preset: RangePreset) {
    setFrom(presetRanges[preset].from)
    setTo(presetRanges[preset].to)
  }

  const activePreset =
    (Object.keys(presetRanges) as RangePreset[]).find(
      (k) => presetRanges[k].from === from && presetRanges[k].to === to,
    ) ?? null

  return (
    <div className="space-y-6 pb-12">
      {/* Encabezado */}
      <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Analíticas</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Histórico consolidado de kilos recibidos (2024–2026), comparativas año contra año y reportes directivos.
          </p>
        </div>

        {report && (
          <PDFDownloadLink document={<KgComparisonDocument data={report} />} fileName={filename}>
            {({ loading: building }) => (
              <Button disabled={building} className="shrink-0">
                {building ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generando PDF…
                  </>
                ) : (
                  <>
                    <Download className="mr-2 h-4 w-4" />
                    Descargar reporte PDF
                  </>
                )}
              </Button>
            )}
          </PDFDownloadLink>
        )}
      </header>

      <DateRangeToolbar
        from={from}
        to={to}
        onFromChange={setFrom}
        onToChange={setTo}
        onPreset={setPreset}
        activePreset={activePreset}
        min={`${HISTORICAL_FIRST_MONTH}-01`}
        max={today}
        invalid={invalidRange}
      />

      {loading && (
        <Card>
          <CardContent className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            Cargando historial consolidado…
          </CardContent>
        </Card>
      )}

      {error && (
        <Card>
          <CardContent className="py-10 text-center text-sm text-red-700">
            No se pudo cargar la base histórica. Verifica la conexión con Supabase.
          </CardContent>
        </Card>
      )}

      {report && !loading && (
        <>
          {/* Smart UI/UX - Tell 3: Métrica Primaria Destacada + Secundarias Compactas */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {/* Primaria Hero: Ocupa espacio prominente con contexto completo */}
            <div className="flex flex-col rounded-2xl border border-border/80 bg-card p-6 shadow-none lg:col-span-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Total Recibido en Período
                </span>
                <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                  {from} → {to}
                </span>
              </div>

              <div className="mt-3 flex flex-wrap items-baseline gap-4">
                <div className="text-4xl font-extrabold tracking-tight tabular-nums text-foreground">
                  {toneladas(report.comparison.current.kg)}
                </div>
                <div
                  className={cn(
                    'flex items-center gap-1 text-sm font-semibold tabular-nums',
                    report.comparison.deltaPct === null
                      ? 'text-muted-foreground'
                      : report.comparison.deltaPct >= 0
                        ? 'text-green-700'
                        : 'text-red-700',
                  )}
                >
                  {report.comparison.deltaPct !== null && (
                    report.comparison.deltaPct >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />
                  )}
                  {pctLabel(report.comparison.deltaPct)}
                  <span className="text-xs font-normal text-muted-foreground">vs año anterior</span>
                </div>
              </div>

              {/* Las tres del desglose eran texto corrido de 12px y dejaban
                  media tarjeta en blanco. Como cifras propias llenan el alto y
                  además se pueden leer de un vistazo. `mt-auto` las ancla al
                  pie, así el bloque crece con la tarjeta. */}
              <dl className="mt-auto grid grid-cols-3 gap-4 border-t border-border/60 pt-5">
                <div>
                  <dt className="text-xs text-muted-foreground">Kilos netos</dt>
                  <dd className="mt-1 text-xl font-bold tabular-nums text-foreground">
                    {kgLabel(report.comparison.current.kg)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Días con actividad</dt>
                  <dd className="mt-1 text-xl font-bold tabular-nums text-foreground">
                    {report.comparison.current.days}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Pesajes registrados</dt>
                  <dd className="mt-1 text-xl font-bold tabular-nums text-foreground">
                    {NUM.format(report.comparison.current.records)}
                  </dd>
                </div>
              </dl>
            </div>

            {/* Secundarias Compactas */}
            <div className="flex flex-col justify-between gap-3">
              <div className="rounded-2xl border border-border/80 bg-card p-4">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Promedio Diario
                </span>
                <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">
                  {report.comparison.avgKgPerDay === null
                    ? '—'
                    : kgLabel(report.comparison.avgKgPerDay)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Calculado sobre {report.comparison.current.days} días con pesajes
                </p>
              </div>

              <div className="rounded-2xl border border-border/80 bg-card p-4">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Promedio por Pesaje
                </span>
                <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">
                  {report.comparison.avgKgPerRecord === null
                    ? '—'
                    : kgLabel(report.comparison.avgKgPerRecord)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Media por tacho recibido
                </p>
              </div>
            </div>
          </div>

          {/* Gráfico Comparativo Anual */}
          <YearComparisonSection
            series={yearSeries}
            currentMonth={currentMonth}
            loading={loading}
            error={error}
            hideReportLink={true}
          />

          {/* Kg por empresa, mes a mes — acá sí navega hasta enero 2024,
              porque esta página carga el histórico de planta. */}
          <MonthlyBarChart
            data={monthlyKg}
            month={month}
            onMonthChange={setMonth}
            maxMonth={currentMonth}
            minMonth={HISTORICAL_FIRST_MONTH}
            // Los procesados solo se muestran cuando TODO el mes viene del
            // sistema. En un mes con días del histórico, el procesado cubriría
            // menos días que el recibido y se leería como una merma inexistente.
            showProcessed={monthSource === 'sistema'}
            note={
              monthSource === 'sistema'
                ? undefined
                : error
                  ? 'No se pudo cargar el histórico, así que a este mes le faltan días. No significa que no haya habido actividad: recargá la página.'
                  : monthSource === 'mixto'
                    ? 'Mes del corte: los primeros días vienen de las planillas de planta y el resto de los pesajes registrados en el sistema. No incluye procesados, porque solo existen para la segunda parte del mes.'
                    : 'Mes histórico, tomado de las planillas de kilos diarios de planta. No incluye procesados: la fecha de tratado era opcional en ese formulario.'
            }
          />

          {/* Detalle Mes a Mes vs Año Anterior (Smart UI/UX: tabla con alineación y números tabulares) */}
          <Card>
            <CardContent className="pt-6">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold text-foreground">
                    Detalle mensual comparado
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Kilos del período contrastados con el mismo mes del año previo.
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="py-2.5 pr-4 text-left font-semibold">Mes</th>
                      <th className="py-2.5 px-3 text-right font-semibold">Kilos</th>
                      <th className="py-2.5 px-3 text-right font-semibold">Año anterior</th>
                      <th className="py-2.5 px-3 text-right font-semibold">Variación</th>
                      <th className="py-2.5 pl-3 text-right font-semibold">Pesajes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {report.months.map((m) => (
                      <tr key={m.month} className="hover:bg-muted/30 transition-colors">
                        <td className="py-2.5 pr-4 font-medium text-foreground">{mesLargo(m.month)}</td>
                        <td className="py-2.5 px-3 text-right font-semibold tabular-nums text-foreground">
                          {kgLabel(m.kg)}
                        </td>
                        <td className="py-2.5 px-3 text-right tabular-nums text-muted-foreground">
                          {m.previousKg === null ? '—' : kgLabel(m.previousKg)}
                        </td>
                        <td
                          className={cn(
                            'py-2.5 px-3 text-right font-semibold tabular-nums',
                            m.deltaPct === null
                              ? 'text-muted-foreground'
                              : m.deltaPct >= 0
                                ? 'text-green-700'
                                : 'text-red-700',
                          )}
                        >
                          {pctLabel(m.deltaPct)}
                        </td>
                        <td className="py-2.5 pl-3 text-right tabular-nums text-muted-foreground">
                          {NUM.format(m.records)}
                        </td>
                      </tr>
                    ))}
                    {report.months.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                          Sin pesajes registrados en el rango seleccionado.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Participación por Empresa y Consolidado Anual */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardContent className="pt-6">
                <h2 className="text-base font-semibold text-foreground">
                  Participación por empresa
                </h2>
                <p className="mb-4 text-xs text-muted-foreground">
                  Distribución de los kilos recibidos en el período seleccionado.
                </p>
                <ul className="space-y-3">
                  {report.byCompany.map((c) => (
                    <li key={c.name} className="space-y-1">
                      <div className="flex items-baseline justify-between gap-3 text-sm">
                        <span className="font-medium text-foreground">{c.name}</span>
                        <span className="tabular-nums text-muted-foreground">
                          {kgLabel(c.kg)}{' '}
                          <strong className="font-semibold text-foreground">
                            ({NUM1.format(c.sharePct)}%)
                          </strong>
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${Math.min(c.sharePct, 100)}%` }}
                        />
                      </div>
                    </li>
                  ))}
                  {report.byCompany.length === 0 && (
                    <li className="py-4 text-center text-sm text-muted-foreground">
                      Sin datos para este rango.
                    </li>
                  )}
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <h2 className="text-base font-semibold text-foreground">
                  Consolidado anual histórico
                </h2>
                <p className="mb-4 text-xs text-muted-foreground">
                  Total de toneladas y pesajes por año completo en la base.
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                        <th className="py-2.5 pr-4 text-left font-semibold">Año</th>
                        <th className="py-2.5 px-3 text-right font-semibold">Toneladas</th>
                        <th className="py-2.5 pl-3 text-right font-semibold">Pesajes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                      {report.years.map((y) => (
                        <tr key={y.year} className="hover:bg-muted/30 transition-colors">
                          <td className="py-2.5 pr-4 font-bold text-foreground">{y.year}</td>
                          <td className="py-2.5 px-3 text-right font-semibold tabular-nums text-foreground">
                            {toneladas(y.totalKg)}
                          </td>
                          <td className="py-2.5 pl-3 text-right tabular-nums text-muted-foreground">
                            {NUM.format(y.totalRecords)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Nota de Metodología y Exportación */}
          <Card>
            <CardContent className="flex flex-wrap items-center justify-between gap-4 pt-6">
              <p className="max-w-xl text-xs text-muted-foreground leading-relaxed">
                <strong>Metodología de datos:</strong> Peso neto recibido (bruto menos tara). Hasta el 6-sep-2026
                proviene de las planillas de planta; desde el 7-sep-2026, de los pesajes registrados en {APP_NAME}.
                Las fuentes no se solapan y están blindadas contra duplicación.
              </p>

              <PDFDownloadLink document={<KgComparisonDocument data={report} />} fileName={filename}>
                {({ loading: building }) => (
                  <Button disabled={building} variant="outline">
                    {building ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Generando PDF…
                      </>
                    ) : (
                      <>
                        <Download className="mr-2 h-4 w-4" />
                        Exportar reporte en PDF
                      </>
                    )}
                  </Button>
                )}
              </PDFDownloadLink>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
