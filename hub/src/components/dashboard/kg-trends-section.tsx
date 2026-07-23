'use client'

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { TrendingUp, TrendingDown, Minus, LineChart as LineChartIcon } from 'lucide-react'
import { cn } from '@hospiwaste/shared/lib/utils'
import { formatKg } from '@hospiwaste/shared/lib/data/dashboard-metrics'
import type {
  DailyKgPoint,
  MonthComparison,
  YearAccumulated,
} from '@hospiwaste/shared/lib/data/dashboard-analytics'

const SERIES_COLOR = '#2A27E9'

const DAY_FORMATTER = new Intl.DateTimeFormat('es-PA', { day: 'numeric', month: 'short' })
const MONTH_FORMATTER = new Intl.DateTimeFormat('es-PA', { month: 'long', year: 'numeric' })

function dayLabel(date: string): string {
  return DAY_FORMATTER.format(new Date(`${date}T12:00:00Z`))
}

interface TooltipProps {
  active?: boolean
  payload?: Array<{ payload: DailyKgPoint }>
}

function SeriesTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload?.length) return null
  const point = payload[0].payload
  return (
    <div className="rounded-md bg-foreground px-3 py-2 text-xs text-background shadow-lg ring-1 ring-foreground/20">
      <p className="font-semibold first-letter:uppercase">{dayLabel(point.date)}</p>
      <p className="tabular-nums opacity-90">{formatKg(point.kg)}</p>
    </div>
  )
}

interface Props {
  series: DailyKgPoint[]
  monthComparison: MonthComparison
  yearAccumulated: YearAccumulated
  avgWeightPerContainer: number | null
}

/** Tendencia de kg: serie de 30 días + comparativa mensual + acumulado anual. */
export function KgTrendsSection({ series, monthComparison, yearAccumulated, avgWeightPerContainer }: Props) {
  const delta = monthComparison.deltaPct
  const DeltaIcon = delta === null || delta === 0 ? Minus : delta > 0 ? TrendingUp : TrendingDown

  return (
    <section className="rounded-2xl bg-card p-5 ring-1 ring-foreground/10">
      <header className="mb-4 flex items-center gap-2.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/10 text-accent">
          <LineChartIcon className="h-4 w-4" />
        </div>
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Tendencia de kg recibidos
          </h2>
          <p className="text-xs text-muted-foreground/80">Últimos 30 días</p>
        </div>
      </header>

      <div className="h-52 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={series} margin={{ top: 4, right: 4, bottom: 0, left: -14 }}>
            <defs>
              <linearGradient id="kgTrendFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={SERIES_COLOR} stopOpacity={0.25} />
                <stop offset="100%" stopColor={SERIES_COLOR} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#E2E8F0" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={dayLabel}
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
              minTickGap={40}
            />
            <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={54} />
            <Tooltip content={<SeriesTooltip />} cursor={{ stroke: '#94A3B8', strokeDasharray: '3 3' }} />
            <Area
              type="monotone"
              dataKey="kg"
              stroke={SERIES_COLOR}
              strokeWidth={2}
              fill="url(#kgTrendFill)"
              dot={false}
              activeDot={{ r: 4 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <dl className="mt-4 grid grid-cols-1 gap-3 border-t border-border pt-4 sm:grid-cols-3">
        <div>
          <dt className="text-xs text-muted-foreground first-letter:uppercase">
            {MONTH_FORMATTER.format(new Date(`${monthComparison.month}-15T12:00:00Z`))}
          </dt>
          <dd className="mt-0.5 flex items-baseline gap-2">
            <span className="text-xl font-bold tabular-nums text-foreground">
              {formatKg(monthComparison.monthKg)}
            </span>
            <span
              className={cn(
                'flex items-center gap-0.5 text-xs font-medium tabular-nums',
                delta === null || delta === 0
                  ? 'text-muted-foreground'
                  : delta > 0
                    ? 'text-green-700'
                    : 'text-red-700',
              )}
              title="Variación vs mes anterior"
            >
              <DeltaIcon className="size-3.5" />
              {delta === null ? 's/d' : `${Math.abs(delta)}%`}
            </span>
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Acumulado {yearAccumulated.year}</dt>
          <dd className="mt-0.5 text-xl font-bold tabular-nums text-foreground">
            {formatKg(yearAccumulated.totalKg)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Promedio por tacho (30 días)</dt>
          <dd className="mt-0.5 text-xl font-bold tabular-nums text-foreground">
            {avgWeightPerContainer === null ? '—' : formatKg(avgWeightPerContainer)}
          </dd>
        </div>
      </dl>
    </section>
  )
}
