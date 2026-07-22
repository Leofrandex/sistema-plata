'use client'

import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'
import { Scale, TrendingUp, Clock } from 'lucide-react'
import { cn } from '@hospiwaste/shared/lib/utils'
import { formatKg, type DailyKgMetrics } from '@hospiwaste/shared/lib/data/dashboard-metrics'

interface Props {
  data: DailyKgMetrics
}

const PROCESSED_COLOR = '#0B1A48' // primary
const PENDING_COLOR = '#F59E0B'   // amber

export function DailyKgDonut({ data }: Props) {
  const { receivedKg, processedKg, pendingKg } = data

  // Si no hay nada recibido todavía, dibujamos un placeholder
  const chartData =
    receivedKg > 0
      ? [
          { name: 'Procesado', value: processedKg, color: PROCESSED_COLOR },
          { name: 'Pendiente', value: pendingKg, color: PENDING_COLOR },
        ].filter((d) => d.value > 0)
      : [{ name: 'Sin datos', value: 1, color: '#E2E8F0' }]

  const processedPct = receivedKg > 0 ? Math.round((processedKg / receivedKg) * 100) : 0

  return (
    <section className="rounded-2xl bg-card p-5 ring-1 ring-foreground/10">
      <header className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Scale className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Kilogramos del día
            </h2>
            <p className="text-xs text-muted-foreground/80">Procesados vs. pendientes hoy</p>
          </div>
        </div>
      </header>

      <div className="flex flex-col items-center gap-4 lg:flex-row lg:items-stretch">
        <div className="relative h-56 w-full max-w-xs">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={68}
                outerRadius={92}
                paddingAngle={receivedKg > 0 ? 2 : 0}
                startAngle={90}
                endAngle={-270}
                stroke="none"
                isAnimationActive
              >
                {chartData.map((entry, idx) => (
                  <Cell key={idx} fill={entry.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>

          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <p className="text-3xl font-bold tabular-nums text-foreground leading-none">
              {processedKg.toFixed(2)}
              <span className="text-sm font-medium text-muted-foreground"> kg</span>
            </p>
            <p className="text-xs text-muted-foreground mt-1">procesados</p>
            {receivedKg > 0 && (
              <p className="mt-1 text-[10px] font-semibold text-primary tabular-nums">
                {processedPct}% del total
              </p>
            )}
          </div>
        </div>

        <div className="flex-1 space-y-3 self-center lg:self-stretch lg:py-4">
          <MetricRow
            color={PROCESSED_COLOR}
            icon={<TrendingUp className="h-4 w-4" />}
            label="Procesado hoy"
            value={formatKg(processedKg)}
            tone="primary"
          />
          <MetricRow
            color={PENDING_COLOR}
            icon={<Clock className="h-4 w-4" />}
            label="Pendiente por procesar"
            value={formatKg(pendingKg)}
            tone="amber"
          />
          <div className="border-t border-foreground/5 pt-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Total recibido hoy</span>
              <span className="font-semibold tabular-nums">{formatKg(receivedKg)}</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

interface MetricRowProps {
  color: string
  icon: React.ReactNode
  label: string
  value: string
  tone: 'primary' | 'amber'
}

function MetricRow({ color, icon, label, value, tone }: MetricRowProps) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 min-w-0">
        <span
          className="inline-block size-3 shrink-0 rounded-sm"
          style={{ backgroundColor: color }}
          aria-hidden
        />
        <span
          className={cn(
            'flex items-center gap-1.5 text-sm',
            tone === 'primary' ? 'text-foreground/80' : 'text-amber-700',
          )}
        >
          {icon}
          {label}
        </span>
      </div>
      <span className="font-semibold tabular-nums text-foreground">{value}</span>
    </div>
  )
}
