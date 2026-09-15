'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { CalendarRange, ChevronRight, TrendingDown, TrendingUp } from 'lucide-react'
import { cn } from '@hospiwaste/shared/lib/utils'
import {
  MONTH_LABELS,
  monthlyComparisonPoints,
  type YearMonthlySeries,
} from '@hospiwaste/shared/lib/data/historical-kg'

/**
 * Paleta por ano: el mas viejo mas apagado, el ano en curso en el acento de
 * marca. Ordenada de viejo a nuevo; si algun dia hay mas anos que colores, se
 * repite el ciclo (no es un problema real en el horizonte de este piloto).
 */
const YEAR_COLORS = ['#CBD5E1', '#94A3B8', '#2A27E9', '#7C3AED', '#0EA5E9']

const KG = new Intl.NumberFormat('es-PA', { maximumFractionDigits: 0 })

function kgLabel(value: number): string {
  return `${KG.format(value)} kg`
}

function toneladas(value: number): string {
  return `${(value / 1000).toFixed(1)} t`
}

interface TooltipItem {
  name: string
  value: number | null
  color: string
  dataKey: string
}

function ComparisonTooltip({
  active,
  payload,
  label,
  partialMonth,
}: {
  active?: boolean
  payload?: TooltipItem[]
  label?: string
  /** Etiqueta del mes en curso ('Sep'), si alguno lo está. */
  partialMonth?: string
}) {
  const shown = payload?.filter((p) => p.value !== null && p.value !== undefined)
  if (!active || !shown?.length) return null

  const parcial = label === partialMonth

  // El delta contra el ano anterior es la lectura que la directiva busca, asi
  // que se calcula aca mismo en vez de dejarla de tarea mental. En el mes en
  // curso se omite: comparar dias corridos contra un mes entero no dice nada.
  const ordered = [...shown].sort((a, b) => a.dataKey.localeCompare(b.dataKey))
  const first = ordered[0]?.value ?? null
  const last = ordered[ordered.length - 1]?.value ?? null
  const delta =
    !parcial && first && last && ordered.length > 1 ? ((last - first) / first) * 100 : null

  return (
    <div className="min-w-[180px] rounded-md bg-foreground px-3 py-2 text-xs text-background shadow-lg ring-1 ring-foreground/20">
      <p className="mb-1 font-semibold">{label}</p>
      {ordered.map((p) => (
        <p key={p.dataKey} className="flex items-center justify-between gap-3 tabular-nums">
          <span className="flex items-center gap-1.5">
            <span className="inline-block size-2 rounded-sm" style={{ backgroundColor: p.color }} />
            {p.name}
          </span>
          <span className="font-semibold">{kgLabel(p.value as number)}</span>
        </p>
      ))}
      {delta !== null && (
        <p className="mt-1.5 border-t border-background/20 pt-1.5 opacity-80">
          {ordered[0].name} → {ordered[ordered.length - 1].name}:{' '}
          <span className="font-semibold">
            {delta > 0 ? '+' : ''}
            {delta.toFixed(0)}%
          </span>
        </p>
      )}
      {parcial && (
        <p className="mt-1.5 border-t border-background/20 pt-1.5 opacity-80">Mes en curso</p>
      )}
    </div>
  )
}

interface Props {
  series: YearMonthlySeries[]
  /** La carga del histórico falló o expiró. */
  error?: boolean
  /**
   * Mes en curso ('YYYY-MM'). Se excluye del resumen año-contra-año: comparar
   * un mes a medio andar contra el mismo mes completo del año anterior dibuja
   * una caída que no existe. Sí se dibuja en las barras, donde se lee como
   * parcial.
   */
  currentMonth?: string
  loading?: boolean
}

/**
 * Comparativo ano contra ano de kilos recibidos, mes a mes. Une el historico
 * de planta (2024 -> 2026-09-06) con lo que registra el sistema; el corte
 * entre fuentes no es visible porque ambas alimentan la misma serie.
 */
export function YearComparisonSection({
  series,
  currentMonth,
  error = false,
  loading = false,
}: Props) {
  // Años ocultos por el usuario. Se guarda lo OCULTO y no lo visible para que
  // un año nuevo en los datos aparezca solo, sin tener que tocar este estado.
  const [hiddenYears, setHiddenYears] = useState<ReadonlySet<string>>(() => new Set())

  // El color se fija por posición en la serie COMPLETA: ocultar un año no debe
  // recolorear a los demás.
  const colorByYear = useMemo(() => {
    const map = new Map<string, string>()
    series.forEach((s, i) => map.set(s.year, YEAR_COLORS[i % YEAR_COLORS.length]))
    return map
  }, [series])
  const colorOf = (year: string) => colorByYear.get(year) ?? YEAR_COLORS[0]

  const visibleSeries = useMemo(
    () => series.filter((s) => !hiddenYears.has(s.year)),
    [series, hiddenYears],
  )

  function toggleYear(year: string) {
    setHiddenYears((prev) => {
      const next = new Set(prev)
      // No se permite apagar el último año visible: un gráfico sin series no
      // comunica nada y deja al usuario sin forma obvia de volver.
      if (!next.has(year) && series.length - next.size <= 1) return prev
      if (next.has(year)) next.delete(year)
      else next.add(year)
      return next
    })
  }

  const points = useMemo(() => monthlyComparisonPoints(visibleSeries), [visibleSeries])

  const years = visibleSeries.map((s) => s.year)

  // 'Sep' si el mes en curso pertenece al año más nuevo que se está mostrando.
  const partialMonthLabel =
    currentMonth && currentMonth.slice(0, 4) === years[years.length - 1]
      ? MONTH_LABELS[Number(currentMonth.slice(5, 7)) - 1]
      : undefined

  // Comparacion de cierre: los dos años VISIBLES más nuevos, solo sobre los
  // meses que ambos tienen. Comparar un ano en curso contra uno completo
  // mentiria. Que siga al filtro es el punto: permite 2024 contra 2026.
  const resumen = useMemo(() => {
    if (visibleSeries.length < 2) return null
    const actual = visibleSeries[visibleSeries.length - 1]
    const previo = visibleSeries[visibleSeries.length - 2]

    // El mes en curso solo se excluye del año al que pertenece de verdad.
    const mesEnCurso =
      currentMonth && currentMonth.slice(0, 4) === actual.year
        ? Number(currentMonth.slice(5, 7)) - 1
        : -1

    const mesesComunes = actual.months
      .map((kg, i) => (i !== mesEnCurso && kg !== null && previo.months[i] !== null ? i : -1))
      .filter((i) => i >= 0)
    if (mesesComunes.length === 0) return null

    const sumaActual = mesesComunes.reduce((s, i) => s + (actual.months[i] ?? 0), 0)
    const sumaPrevia = mesesComunes.reduce((s, i) => s + (previo.months[i] ?? 0), 0)
    return {
      actualYear: actual.year,
      previoYear: previo.year,
      meses: mesesComunes.length,
      sumaActual,
      sumaPrevia,
      deltaPct: sumaPrevia > 0 ? ((sumaActual - sumaPrevia) / sumaPrevia) * 100 : null,
    }
  }, [visibleSeries, currentMonth])

  const DeltaIcon = resumen?.deltaPct != null && resumen.deltaPct < 0 ? TrendingDown : TrendingUp

  return (
    <section className="rounded-2xl bg-card p-5 ring-1 ring-foreground/10">
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/10 text-accent ring-1 ring-accent/20">
            <CalendarRange className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Comparativo anual
            </h2>
            <p className="text-xs text-muted-foreground/80">
              Kilos recibidos por mes
              {years.length > 0 && <> · {years.join(' · ')}</>}
            </p>
          </div>
        </div>
        <Link
          href="/reports/comparativo"
          className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-accent transition-colors hover:bg-accent/10"
        >
          Ver reporte completo
          <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </header>

      {loading ? (
        <div className="flex h-72 items-center justify-center text-sm text-muted-foreground">
          Cargando histórico…
        </div>
      ) : error ? (
        <div className="flex h-72 flex-col items-center justify-center gap-1 px-6 text-center text-sm">
          <p className="font-medium text-red-700">No se pudo cargar el histórico.</p>
          <p className="text-muted-foreground">
            Revisá la conexión y recargá la página. Si estás en planta, puede ser el DNS de la
            operadora contra el host de Supabase.
          </p>
        </div>
      ) : series.length === 0 ? (
        <div className="flex h-72 items-center justify-center text-sm text-muted-foreground">
          Sin histórico cargado.
        </div>
      ) : (
        <>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={points} margin={{ top: 10, right: 8, left: 0, bottom: 0 }} barGap={2}>
                <CartesianGrid stroke="#E2E8F0" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 11, fill: '#64748B' }}
                  tickLine={false}
                  axisLine={{ stroke: '#E2E8F0' }}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#94A3B8' }}
                  tickLine={false}
                  axisLine={false}
                  width={52}
                  tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))}
                />
                <Tooltip
                  content={<ComparisonTooltip partialMonth={partialMonthLabel} />}
                  cursor={{ fill: 'rgba(15,23,42,0.04)' }}
                />
                {/* Sin <Legend>: las tarjetas de abajo cumplen ese rol y además
                    filtran, y dos leyendas compitiendo confunden cuál manda. */}
                {years.map((year) => (
                  <Bar
                    key={year}
                    dataKey={year}
                    name={year}
                    fill={colorOf(year)}
                    radius={[3, 3, 0, 0]}
                    isAnimationActive
                    animationDuration={400}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>

          <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-4 sm:grid-cols-4">
            {series.map((s) => {
              const oculto = hiddenYears.has(s.year)
              const ultimoVisible = !oculto && visibleSeries.length === 1
              return (
                <div key={s.year}>
                  <button
                    type="button"
                    onClick={() => toggleYear(s.year)}
                    disabled={ultimoVisible}
                    aria-pressed={!oculto}
                    title={
                      ultimoVisible
                        ? 'Tiene que quedar al menos un año visible'
                        : oculto
                          ? `Mostrar ${s.year}`
                          : `Ocultar ${s.year}`
                    }
                    className={cn(
                      'group -mx-1.5 -my-1 w-full rounded-lg px-1.5 py-1 text-left transition-colors',
                      'hover:bg-foreground/5 disabled:cursor-default disabled:hover:bg-transparent',
                      oculto && 'opacity-40',
                    )}
                  >
                    <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      {/* Apagado = solo el contorno, para que se lea "no está
                          en el gráfico" y no "es de otro color". */}
                      <span
                        aria-hidden
                        className="inline-block size-2 rounded-sm ring-1 ring-inset ring-foreground/25"
                        style={{ backgroundColor: oculto ? 'transparent' : colorOf(s.year) }}
                      />
                      {s.year}
                    </dt>
                    <dd className="mt-0.5 text-lg font-bold tabular-nums text-foreground">
                      {toneladas(s.totalKg)}
                    </dd>
                  </button>
                </div>
              )
            })}
            {resumen && (
              <div>
                <dt className="text-xs text-muted-foreground">
                  {resumen.actualYear} vs {resumen.previoYear}
                </dt>
                <dd
                  className={cn(
                    'mt-0.5 flex items-baseline gap-1 text-lg font-bold tabular-nums',
                    resumen.deltaPct == null
                      ? 'text-muted-foreground'
                      : resumen.deltaPct >= 0
                        ? 'text-green-700'
                        : 'text-red-700',
                  )}
                  title={`Comparados los primeros ${resumen.meses} meses de cada año`}
                >
                  <DeltaIcon className="size-4" />
                  {resumen.deltaPct == null
                    ? 's/d'
                    : `${resumen.deltaPct > 0 ? '+' : ''}${resumen.deltaPct.toFixed(0)}%`}
                </dd>
              </div>
            )}
          </dl>

          <p className="mt-2 text-xs text-muted-foreground/80">
            Tocá un año para mostrarlo u ocultarlo.
            {resumen && (
              <>
                {' '}
                La variación compara {resumen.meses} {resumen.meses === 1 ? 'mes' : 'meses'}{' '}
                completos de {resumen.actualYear} contra los mismos de {resumen.previoYear}, y sigue
                a los años que tengas visibles. El mes en curso queda fuera del cálculo, aunque sí
                se dibuja en las barras.
              </>
            )}
          </p>
        </>
      )}
    </section>
  )
}
