'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import { BarChart3 } from 'lucide-react'
import { formatKg, type MonthlyKgByCompany } from '@/lib/data/dashboard-metrics'

interface Props {
  data: MonthlyKgByCompany[]
  month: string // YYYY-MM
  onMonthChange: (month: string) => void
  /** Mes máximo que se puede seleccionar — por defecto el actual. */
  maxMonth?: string
}

const RECEIVED_COLOR = '#2A27E9' // accent
const PROCESSED_COLOR = '#10B981' // emerald

interface TooltipItem {
  name: string
  value: number
  color: string
  dataKey: string
}

interface CustomTooltipProps {
  active?: boolean
  payload?: TooltipItem[]
  label?: string
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-md bg-foreground text-background px-3 py-2 text-xs shadow-lg ring-1 ring-foreground/20 min-w-[140px]">
      <p className="font-semibold mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} className="flex items-center justify-between gap-3 tabular-nums">
          <span className="flex items-center gap-1.5">
            <span className="inline-block size-2 rounded-sm" style={{ backgroundColor: p.color }} />
            {p.name}
          </span>
          <span className="font-semibold">{formatKg(p.value)}</span>
        </p>
      ))}
    </div>
  )
}

function formatMonthLabel(month: string): string {
  // 'YYYY-MM' → 'Mayo 2026' (es-PA)
  const [yyyy, mm] = month.split('-')
  if (!yyyy || !mm) return month
  const date = new Date(Number(yyyy), Number(mm) - 1, 1)
  return date.toLocaleDateString('es-PA', { month: 'long', year: 'numeric' })
}

export function MonthlyBarChart({ data, month, onMonthChange, maxMonth }: Props) {
  const totalReceived = data.reduce((sum, d) => sum + d.receivedKg, 0)
  const totalProcessed = data.reduce((sum, d) => sum + d.processedKg, 0)
  const hasData = totalReceived > 0 || totalProcessed > 0

  // Si hay datos, mostramos solo empresas con actividad; si no, mostramos todas
  // para que la composición no quede vacía.
  const chartData = hasData ? data.filter((d) => d.receivedKg > 0 || d.processedKg > 0) : data

  return (
    <section className="rounded-2xl bg-card p-5 ring-1 ring-foreground/10">
      <header className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/10 text-accent">
            <BarChart3 className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Kilogramos del mes
            </h2>
            <p className="text-xs text-muted-foreground/80">
              Recibidos vs. procesados por empresa — {formatMonthLabel(month)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="font-semibold uppercase tracking-wide">Mes</span>
            <input
              type="month"
              value={month}
              max={maxMonth}
              onChange={(e) => onMonthChange(e.target.value)}
              className="rounded-md border border-foreground/10 bg-card px-2 py-1 text-foreground text-xs tabular-nums focus:outline-none focus:ring-2 focus:ring-accent/40"
            />
          </label>
          <div className="flex gap-2 text-xs">
            <div className="rounded-lg ring-1 ring-foreground/10 bg-muted/30 px-3 py-1.5">
              <p className="text-muted-foreground">Total recibido</p>
              <p className="font-semibold tabular-nums text-foreground">{formatKg(totalReceived)}</p>
            </div>
            <div className="rounded-lg ring-1 ring-foreground/10 bg-muted/30 px-3 py-1.5">
              <p className="text-muted-foreground">Total procesado</p>
              <p className="font-semibold tabular-nums text-foreground">{formatKg(totalProcessed)}</p>
            </div>
          </div>
        </div>
      </header>

      <div className="h-72 w-full">
        {chartData.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Sin actividad registrada este mes.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 10, right: 16, left: 0, bottom: 0 }}
              barCategoryGap={32}
              barGap={6}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
              <XAxis
                dataKey="company_name"
                tick={{ fontSize: 12, fill: '#64748B' }}
                tickLine={false}
                axisLine={{ stroke: '#E2E8F0' }}
              />
              <YAxis
                tick={{ fontSize: 11, fill: '#94A3B8' }}
                tickLine={false}
                axisLine={false}
                label={{
                  value: 'kg',
                  position: 'insideTopLeft',
                  offset: -2,
                  fontSize: 10,
                  fill: '#94A3B8',
                }}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(15,23,42,0.04)' }} />
              <Legend
                verticalAlign="top"
                align="right"
                iconType="rect"
                wrapperStyle={{ fontSize: 12, paddingBottom: 8 }}
              />
              <Bar dataKey="receivedKg" name="Recibidos" fill={RECEIVED_COLOR} radius={[6, 6, 0, 0]}>
                {chartData.map((entry) => (
                  <Cell key={`r-${entry.company_id}`} />
                ))}
              </Bar>
              <Bar dataKey="processedKg" name="Procesados" fill={PROCESSED_COLOR} radius={[6, 6, 0, 0]}>
                {chartData.map((entry) => (
                  <Cell key={`p-${entry.company_id}`} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </section>
  )
}
