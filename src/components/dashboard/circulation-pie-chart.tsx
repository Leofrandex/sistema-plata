'use client'

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { Boxes } from 'lucide-react'
import type { CirculationBreakdown } from '@/lib/data/dashboard-metrics'

interface Props {
  data: CirculationBreakdown
}

interface TooltipPayload {
  payload: {
    label: string
    count: number
    color: string
  }
}

interface CustomTooltipProps {
  active?: boolean
  payload?: TooltipPayload[]
  total: number
}

function CustomTooltip({ active, payload, total }: CustomTooltipProps) {
  if (!active || !payload?.length) return null
  const item = payload[0].payload
  const pct = total > 0 ? Math.round((item.count / total) * 100) : 0
  return (
    <div className="rounded-md bg-foreground text-background px-3 py-2 text-xs shadow-lg ring-1 ring-foreground/20">
      <p className="font-semibold">{item.label}</p>
      <p className="tabular-nums opacity-90">
        {item.count} envase{item.count !== 1 ? 's' : ''} · {pct}%
      </p>
    </div>
  )
}

export function CirculationPieChart({ data }: Props) {
  const chartData = data.buckets.filter((b) => b.count > 0)
  const hasData = chartData.length > 0

  return (
    <section className="rounded-2xl bg-card p-5 ring-1 ring-foreground/10">
      <header className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Boxes className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Envases en circulación
            </h2>
            <p className="text-xs text-muted-foreground/80">Distribución por ubicación actual</p>
          </div>
        </div>
      </header>

      <div className="flex flex-col items-center gap-4 lg:flex-row lg:items-stretch">
        <div className="relative h-56 w-full lg:w-1/2">
          {hasData ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  dataKey="count"
                  nameKey="label"
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={2}
                  stroke="none"
                >
                  {chartData.map((entry) => (
                    <Cell key={entry.key} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  content={<CustomTooltip total={data.total} />}
                  cursor={{ fill: 'transparent' }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Sin envases activos.
            </div>
          )}

          {/* Total en el centro */}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <p className="text-3xl font-bold tabular-nums text-foreground leading-none">
                {data.total}
              </p>
              <p className="text-xs text-muted-foreground mt-1">total</p>
            </div>
          </div>
        </div>

        {/* Legend */}
        <ul className="flex-1 space-y-2 self-center lg:self-stretch lg:py-4">
          {data.buckets.map((bucket) => {
            const pct = data.total > 0 ? Math.round((bucket.count / data.total) * 100) : 0
            return (
              <li key={bucket.key} className="flex items-center justify-between gap-3 text-sm">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="inline-block size-3 shrink-0 rounded-sm"
                    style={{ backgroundColor: bucket.color }}
                    aria-hidden
                  />
                  <span className="text-foreground/80 truncate">{bucket.label}</span>
                </div>
                <div className="flex items-baseline gap-1.5 shrink-0">
                  <span className="font-semibold tabular-nums">{bucket.count}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">({pct}%)</span>
                </div>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}
