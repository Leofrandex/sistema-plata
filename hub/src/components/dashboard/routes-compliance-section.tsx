'use client'

import { Route as RouteIcon, CheckCircle2, Timer, CircleDashed, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { cn } from '@hospiwaste/shared/lib/utils'
import type { SlotCompliance, RouteStats } from '@hospiwaste/shared/lib/data/dashboard-analytics'

interface Props {
  compliance: SlotCompliance
  stats: RouteStats
}

/** Cumplimiento de los 6 horarios fijos del día + estadísticas de la semana. */
export function RoutesComplianceSection({ compliance, stats }: Props) {
  const delta = stats.last7Count - stats.prev7Count
  const DeltaIcon = delta > 0 ? TrendingUp : delta < 0 ? TrendingDown : Minus

  return (
    <section className="rounded-2xl bg-card p-5 ring-1 ring-foreground/10">
      <header className="mb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/10 text-accent">
            <RouteIcon className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Recorridos
            </h2>
            <p className="text-xs text-muted-foreground/80">Horarios de andén de hoy</p>
          </div>
        </div>
        <span className="text-sm font-semibold tabular-nums text-foreground">
          {compliance.completed}/{compliance.total}
        </span>
      </header>

      <ul className="grid grid-cols-3 gap-2">
        {compliance.slots.map(({ slot, shortLabel, status }) => (
          <li
            key={slot}
            className={cn(
              'flex flex-col items-center gap-1 rounded-lg px-2 py-2.5',
              status === 'completed' && 'bg-green-50 text-green-700',
              status === 'in_progress' && 'bg-amber-50 text-amber-700',
              status === 'available' && 'bg-muted/60 text-muted-foreground',
            )}
          >
            {status === 'completed' ? (
              <CheckCircle2 className="size-4" />
            ) : status === 'in_progress' ? (
              <Timer className="size-4" />
            ) : (
              <CircleDashed className="size-4" />
            )}
            <span className="text-xs font-semibold tabular-nums">{shortLabel}</span>
          </li>
        ))}
      </ul>

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-border pt-3 text-sm">
        <div className="flex items-center justify-between">
          <dt className="text-muted-foreground">Últimos 7 días</dt>
          <dd className="flex items-center gap-1 font-semibold tabular-nums text-foreground">
            {stats.last7Count}
            <span
              className={cn(
                'flex items-center gap-0.5 text-xs font-medium',
                delta > 0 ? 'text-green-700' : delta < 0 ? 'text-red-700' : 'text-muted-foreground',
              )}
            >
              <DeltaIcon className="size-3.5" />
              {delta !== 0 && Math.abs(delta)}
            </span>
          </dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="text-muted-foreground">Semana anterior</dt>
          <dd className="font-semibold tabular-nums text-foreground">{stats.prev7Count}</dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="text-muted-foreground">Andén / Morgue</dt>
          <dd className="font-semibold tabular-nums text-foreground">
            {stats.anden7} / {stats.morgue7}
          </dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="text-muted-foreground">Tachos por recorrido</dt>
          <dd className="font-semibold tabular-nums text-foreground">
            {stats.avgDirtyPerRoute ?? '—'}
          </dd>
        </div>
      </dl>
    </section>
  )
}
