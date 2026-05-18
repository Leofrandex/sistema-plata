'use client'

import { useEffect, useRef, useState } from 'react'
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
import { BarChart3, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatKg, type MonthlyKgByCompany } from '@/lib/data/dashboard-metrics'

interface Props {
  data: MonthlyKgByCompany[]
  month: string // YYYY-MM
  onMonthChange: (month: string) => void
  /** Mes máximo navegable. Por defecto sin límite. */
  maxMonth?: string
  /** Mes mínimo navegable. Por defecto sin límite. */
  minMonth?: string
}

const RECEIVED_COLOR = '#2A27E9' // accent
const PROCESSED_COLOR = '#10B981' // emerald

// ─── helpers de mes ─────────────────────────────────────────────────────────

function addMonths(month: string, delta: number): string {
  const [yyyy, mm] = month.split('-').map(Number)
  if (!yyyy || !mm) return month
  const d = new Date(yyyy, mm - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function compareMonths(a: string, b: string): number {
  if (a < b) return -1
  if (a > b) return 1
  return 0
}

function formatMonthLabel(month: string): string {
  const [yyyy, mm] = month.split('-')
  if (!yyyy || !mm) return month
  const date = new Date(Number(yyyy), Number(mm) - 1, 1)
  const text = date.toLocaleDateString('es-PA', { month: 'long', year: 'numeric' })
  return text.charAt(0).toUpperCase() + text.slice(1)
}

// ─── tooltip custom ─────────────────────────────────────────────────────────

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

// ─── month switcher ─────────────────────────────────────────────────────────

interface MonthSwitcherProps {
  month: string
  onChange: (m: string) => void
  maxMonth?: string
  minMonth?: string
  /** Notifica al padre la dirección del último cambio para animar el chart. */
  onDirectionChange?: (dir: 'forward' | 'backward') => void
}

function MonthSwitcher({ month, onChange, maxMonth, minMonth, onDirectionChange }: MonthSwitcherProps) {
  const canGoForward = !maxMonth || compareMonths(month, maxMonth) < 0
  const canGoBackward = !minMonth || compareMonths(month, minMonth) > 0

  function goPrev() {
    if (!canGoBackward) return
    onDirectionChange?.('backward')
    onChange(addMonths(month, -1))
  }

  function goNext() {
    if (!canGoForward) return
    onDirectionChange?.('forward')
    onChange(addMonths(month, 1))
  }

  return (
    <div className="flex items-center gap-1 rounded-lg ring-1 ring-foreground/10 bg-card px-1 py-0.5">
      <button
        type="button"
        onClick={goPrev}
        disabled={!canGoBackward}
        aria-label="Mes anterior"
        className={cn(
          'flex h-8 w-8 items-center justify-center rounded-md transition-colors',
          'text-muted-foreground hover:bg-accent/10 hover:text-accent',
          'disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-muted-foreground disabled:cursor-not-allowed',
        )}
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <span className="min-w-[140px] text-center text-sm font-semibold tabular-nums text-foreground select-none">
        {formatMonthLabel(month)}
      </span>
      <button
        type="button"
        onClick={goNext}
        disabled={!canGoForward}
        aria-label="Mes siguiente"
        className={cn(
          'flex h-8 w-8 items-center justify-center rounded-md transition-colors',
          'text-muted-foreground hover:bg-accent/10 hover:text-accent',
          'disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-muted-foreground disabled:cursor-not-allowed',
        )}
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  )
}

// ─── animated chart panel ───────────────────────────────────────────────────
// Maneja una transición de slide cuando el `month` cambia: el contenido viejo
// sale hacia un lado y el nuevo entra desde el opuesto.

interface AnimatedPanelProps {
  contentKey: string
  direction: 'forward' | 'backward' | null
  children: React.ReactNode
}

function AnimatedPanel({ contentKey, direction, children }: AnimatedPanelProps) {
  // Mantenemos hasta dos paneles en el DOM mientras dura la transición.
  const [currentKey, setCurrentKey] = useState(contentKey)
  const [outgoingKey, setOutgoingKey] = useState<string | null>(null)
  const [outgoingChildren, setOutgoingChildren] = useState<React.ReactNode>(null)
  const prevChildrenRef = useRef<React.ReactNode>(children)

  useEffect(() => {
    if (contentKey === currentKey) {
      // Mismo mes: solo refrescar contenido sin animar
      prevChildrenRef.current = children
      return
    }
    // El mes cambió: el panel viejo se va, el nuevo entra
    setOutgoingKey(currentKey)
    setOutgoingChildren(prevChildrenRef.current)
    setCurrentKey(contentKey)
    prevChildrenRef.current = children
    // Limpiar el panel saliente tras la animación
    const t = setTimeout(() => {
      setOutgoingKey(null)
      setOutgoingChildren(null)
    }, 320)
    return () => clearTimeout(t)
  }, [contentKey, currentKey, children])

  const incomingClass =
    direction === 'forward'
      ? 'animate-in slide-in-from-right-8 fade-in-0 duration-300 ease-out'
      : direction === 'backward'
      ? 'animate-in slide-in-from-left-8 fade-in-0 duration-300 ease-out'
      : ''

  const outgoingClass =
    direction === 'forward'
      ? 'animate-out slide-out-to-left-8 fade-out-0 duration-300 ease-out fill-mode-forwards'
      : direction === 'backward'
      ? 'animate-out slide-out-to-right-8 fade-out-0 duration-300 ease-out fill-mode-forwards'
      : ''

  return (
    <div className="relative overflow-hidden">
      {outgoingKey && (
        <div
          key={outgoingKey}
          className={cn('absolute inset-0', outgoingClass)}
          aria-hidden
        >
          {outgoingChildren}
        </div>
      )}
      <div key={currentKey} className={cn(direction ? incomingClass : '')}>
        {children}
      </div>
    </div>
  )
}

// ─── componente principal ──────────────────────────────────────────────────

export function MonthlyBarChart({ data, month, onMonthChange, maxMonth, minMonth }: Props) {
  const [direction, setDirection] = useState<'forward' | 'backward' | null>(null)

  const totalReceived = data.reduce((sum, d) => sum + d.receivedKg, 0)
  const totalProcessed = data.reduce((sum, d) => sum + d.processedKg, 0)
  const hasData = totalReceived > 0 || totalProcessed > 0
  const chartData = hasData ? data.filter((d) => d.receivedKg > 0 || d.processedKg > 0) : data

  return (
    <section className="overflow-hidden rounded-2xl bg-card ring-1 ring-foreground/10">
      {/* Glow decorativo en la esquina superior derecha */}
      <div className="relative">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 -right-24 size-64 rounded-full bg-gradient-to-br from-accent/15 to-primary/0 blur-3xl"
        />

        <div className="relative p-5">
          <header className="flex flex-wrap items-start justify-between gap-3 mb-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/10 text-accent ring-1 ring-accent/20">
                <BarChart3 className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Kilogramos del mes
                </h2>
                <p className="text-xs text-muted-foreground/80">
                  Recibidos vs. procesados por empresa
                </p>
              </div>
            </div>
            <MonthSwitcher
              month={month}
              onChange={onMonthChange}
              maxMonth={maxMonth}
              minMonth={minMonth}
              onDirectionChange={setDirection}
            />
          </header>

          {/* Totales agregados (no animados — son del mes actual seleccionado) */}
          <div className="grid grid-cols-2 gap-3 mb-5">
            <TotalCard
              color={RECEIVED_COLOR}
              label="Total recibido"
              value={formatKg(totalReceived)}
            />
            <TotalCard
              color={PROCESSED_COLOR}
              label="Total procesado"
              value={formatKg(totalProcessed)}
            />
          </div>

          {/* Chart con animación slide */}
          <AnimatedPanel contentKey={month} direction={direction}>
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
                    <Bar
                      dataKey="receivedKg"
                      name="Recibidos"
                      fill={RECEIVED_COLOR}
                      radius={[6, 6, 0, 0]}
                      isAnimationActive
                      animationDuration={400}
                    >
                      {chartData.map((entry) => (
                        <Cell key={`r-${entry.company_id}`} />
                      ))}
                    </Bar>
                    <Bar
                      dataKey="processedKg"
                      name="Procesados"
                      fill={PROCESSED_COLOR}
                      radius={[6, 6, 0, 0]}
                      isAnimationActive
                      animationDuration={400}
                    >
                      {chartData.map((entry) => (
                        <Cell key={`p-${entry.company_id}`} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </AnimatedPanel>
        </div>
      </div>
    </section>
  )
}

interface TotalCardProps {
  color: string
  label: string
  value: string
}

function TotalCard({ color, label, value }: TotalCardProps) {
  return (
    <div className="relative overflow-hidden rounded-lg ring-1 ring-foreground/10 bg-card px-4 py-3">
      <span
        aria-hidden
        className="absolute left-0 top-0 bottom-0 w-1 rounded-l-lg"
        style={{ backgroundColor: color }}
      />
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-bold tabular-nums text-foreground">{value}</p>
    </div>
  )
}
