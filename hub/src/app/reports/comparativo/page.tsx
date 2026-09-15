'use client'

import { useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import { Download, Loader2, Minus, TrendingDown, TrendingUp } from 'lucide-react'
import { Card, CardContent } from '@hospiwaste/shared/components/ui/card'
import { Input } from '@hospiwaste/shared/components/ui/input'
import { Button } from '@hospiwaste/shared/components/ui/button'
import { APP_NAME } from '@hospiwaste/shared/lib/constants'
import { cn } from '@hospiwaste/shared/lib/utils'
import { useStore } from '@hospiwaste/shared/lib/store'
import { unifiedDailyKg } from '@hospiwaste/shared/lib/data/historical-kg'
import { useHistoricalKg } from '@/hooks/use-historical-kg'
import { buildKgComparisonReport } from '@/lib/data/kg-comparison-report'
import { KgComparisonDocument } from '@/components/reports/kg-comparison-document'
import { ReportsTabs } from '@/components/reports/reports-tabs'

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

export default function ComparativeReportPage() {
  const { companies, containers, receptions } = useStore()
  const { rows: historicalRows, loading, error } = useHistoricalKg()

  const today = useMemo(todayISO, [])
  // Por defecto, el año en curso: es la comparación que la directiva pide primero.
  const [from, setFrom] = useState(`${today.slice(0, 4)}-01-01`)
  const [to, setTo] = useState(today)

  const invalidRange = from > to

  const entries = useMemo(
    () => unifiedDailyKg(historicalRows, { companies, containers, receptions }),
    [historicalRows, companies, containers, receptions],
  )

  const report = useMemo(
    () => (invalidRange || entries.length === 0 ? null : buildKgComparisonReport(entries, from, to)),
    [entries, from, to, invalidRange],
  )

  const filename = `${APP_NAME}_ComparativoKilos_${from}_${to}.pdf`

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-foreground">Reportes</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Kilos recibidos por período, comparados contra el mismo período del año anterior.
          Une el histórico de planta desde enero de 2024 con lo que registra {APP_NAME}.
        </p>
      </header>

      <ReportsTabs />

      <Card>
        <CardContent className="grid grid-cols-1 gap-3 pt-6 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor="desde" className="text-sm font-medium text-foreground">
              Desde
            </label>
            <Input id="desde" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="hasta" className="text-sm font-medium text-foreground">
              Hasta
            </label>
            <Input id="hasta" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          {invalidRange && (
            <p className="text-sm text-red-700 sm:col-span-2">
              La fecha inicial es posterior a la final.
            </p>
          )}
        </CardContent>
      </Card>

      {loading && (
        <Card>
          <CardContent className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Cargando histórico…
          </CardContent>
        </Card>
      )}

      {error && (
        <Card>
          <CardContent className="py-10 text-sm text-red-700">
            No se pudo cargar el histórico. Revisá la conexión y recargá la página.
          </CardContent>
        </Card>
      )}

      {report && !loading && (
        <>
          <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi
              label="Total recibido"
              value={toneladas(report.comparison.current.kg)}
              hint={kgLabel(report.comparison.current.kg)}
            />
            <Kpi
              label="Vs. año anterior"
              value={pctLabel(report.comparison.deltaPct)}
              hint={
                report.comparison.previous
                  ? `${toneladas(report.comparison.previous.kg)} en el mismo período`
                  : 'sin período comparable'
              }
              tone={
                report.comparison.deltaPct === null
                  ? 'neutral'
                  : report.comparison.deltaPct >= 0
                    ? 'up'
                    : 'down'
              }
            />
            <Kpi
              label="Promedio diario"
              value={
                report.comparison.avgKgPerDay === null
                  ? '—'
                  : kgLabel(report.comparison.avgKgPerDay)
              }
              hint={`${report.comparison.current.days} días con actividad`}
            />
            <Kpi
              label="Promedio por pesaje"
              value={
                report.comparison.avgKgPerRecord === null
                  ? '—'
                  : kgLabel(report.comparison.avgKgPerRecord)
              }
              hint={`${NUM.format(report.comparison.current.records)} pesajes`}
            />
          </section>

          <Card>
            <CardContent className="pt-6">
              <h2 className="mb-3 text-sm font-semibold text-foreground">
                Mes a mes, contra el mismo mes del año anterior
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="py-2 pr-3 text-left font-semibold">Mes</th>
                      <th className="py-2 px-3 text-right font-semibold">Kilos</th>
                      <th className="py-2 px-3 text-right font-semibold">Año anterior</th>
                      <th className="py-2 px-3 text-right font-semibold">Variación</th>
                      <th className="py-2 pl-3 text-right font-semibold">Pesajes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.months.map((m) => (
                      <tr key={m.month} className="border-b border-border/50 last:border-0">
                        <td className="py-2 pr-3 text-foreground">{mesLargo(m.month)}</td>
                        <td className="py-2 px-3 text-right tabular-nums text-foreground">
                          {kgLabel(m.kg)}
                        </td>
                        <td className="py-2 px-3 text-right tabular-nums text-muted-foreground">
                          {m.previousKg === null ? '—' : kgLabel(m.previousKg)}
                        </td>
                        <td
                          className={cn(
                            'py-2 px-3 text-right font-medium tabular-nums',
                            m.deltaPct === null
                              ? 'text-muted-foreground'
                              : m.deltaPct >= 0
                                ? 'text-green-700'
                                : 'text-red-700',
                          )}
                        >
                          {pctLabel(m.deltaPct)}
                        </td>
                        <td className="py-2 pl-3 text-right tabular-nums text-muted-foreground">
                          {NUM.format(m.records)}
                        </td>
                      </tr>
                    ))}
                    {report.months.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-6 text-center text-muted-foreground">
                          Sin actividad en el rango elegido.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardContent className="pt-6">
                <h2 className="mb-3 text-sm font-semibold text-foreground">
                  Participación por empresa
                </h2>
                <ul className="space-y-2.5">
                  {report.byCompany.map((c) => (
                    <li key={c.name}>
                      <div className="flex items-baseline justify-between gap-3 text-sm">
                        <span className="text-foreground">{c.name}</span>
                        <span className="tabular-nums text-muted-foreground">
                          {kgLabel(c.kg)} · {NUM1.format(c.sharePct)}%
                        </span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-accent"
                          style={{ width: `${c.sharePct}%` }}
                        />
                      </div>
                    </li>
                  ))}
                  {report.byCompany.length === 0 && (
                    <li className="py-4 text-center text-sm text-muted-foreground">
                      Sin actividad en el rango elegido.
                    </li>
                  )}
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <h2 className="mb-3 text-sm font-semibold text-foreground">
                  Total por año (histórico completo)
                </h2>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="py-2 pr-3 text-left font-semibold">Año</th>
                      <th className="py-2 px-3 text-right font-semibold">Toneladas</th>
                      <th className="py-2 pl-3 text-right font-semibold">Pesajes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.years.map((y) => (
                      <tr key={y.year} className="border-b border-border/50 last:border-0">
                        <td className="py-2 pr-3 text-foreground">{y.year}</td>
                        <td className="py-2 px-3 text-right tabular-nums text-foreground">
                          {toneladas(y.totalKg)}
                        </td>
                        <td className="py-2 pl-3 text-right tabular-nums text-muted-foreground">
                          {NUM.format(y.totalRecords)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-6">
              <p className="max-w-xl text-xs text-muted-foreground">
                Peso neto recibido (bruto menos tara). Hasta el 6-sep-2026 viene de las planillas
                de kilos diarios de planta; desde el 7-sep-2026, de los pesajes registrados en{' '}
                {APP_NAME}. Las dos fuentes no se solapan.
              </p>
              <PDFDownloadLink document={<KgComparisonDocument data={report} />} fileName={filename}>
                {({ loading: building }) => (
                  <Button disabled={building}>
                    {building ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Generando…
                      </>
                    ) : (
                      <>
                        <Download className="mr-2 h-4 w-4" />
                        Descargar PDF
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

interface KpiProps {
  label: string
  value: string
  hint: string
  tone?: 'up' | 'down' | 'neutral'
}

function Kpi({ label, value, hint, tone }: KpiProps) {
  const Icon = tone === 'up' ? TrendingUp : tone === 'down' ? TrendingDown : Minus

  return (
    <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p
        className={cn(
          'mt-1 flex items-baseline gap-1 text-xl font-bold tabular-nums',
          tone === 'up' ? 'text-green-700' : tone === 'down' ? 'text-red-700' : 'text-foreground',
        )}
      >
        {tone && <Icon className="size-4" />}
        {value}
      </p>
      <p className="mt-0.5 text-xs text-muted-foreground/80">{hint}</p>
    </div>
  )
}
