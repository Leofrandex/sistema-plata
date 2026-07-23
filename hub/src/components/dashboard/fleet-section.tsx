'use client'

import { Boxes, Flame, Truck } from 'lucide-react'
import { formatDuration } from '@hospiwaste/shared/lib/data/dashboard-metrics'
import type { FleetBreakdown } from '@hospiwaste/shared/lib/data/dashboard-analytics'

interface Props {
  fleet: FleetBreakdown
}

/** Composición de la flota y operaciones de planta (tratamientos, traslados). */
export function FleetSection({ fleet }: Props) {
  return (
    <section className="rounded-2xl bg-card p-5 ring-1 ring-foreground/10">
      <header className="mb-4 flex items-center gap-2.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Boxes className="h-4 w-4" />
        </div>
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Flota y planta
          </h2>
          <p className="text-xs text-muted-foreground/80">
            {fleet.activeCount} tachos activos · {fleet.decommissionedCount} de baja
          </p>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-x-6 gap-y-4">
        <div>
          <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Por tamaño
          </h3>
          <ul className="space-y-1 text-sm">
            {fleet.bySize.map(({ size, count }) => (
              <li key={size} className="flex items-center justify-between">
                <span className="text-foreground/80">{size} L</span>
                <span className="font-semibold tabular-nums text-foreground">{count}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Por empresa
          </h3>
          <ul className="space-y-1 text-sm">
            {fleet.byCompany.map(({ companyId, companyName, count }) => (
              <li key={companyId ?? 'none'} className="flex items-center justify-between">
                <span className="truncate text-foreground/80">{companyName}</span>
                <span className="font-semibold tabular-nums text-foreground">{count}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-4">
        <div className="flex items-center gap-3 rounded-lg bg-muted/60 px-3 py-2.5">
          <Flame className="size-4 shrink-0 text-violet-700" />
          <div className="min-w-0">
            <dd className="text-lg font-bold tabular-nums leading-none text-foreground">
              {fleet.treatmentsCompleted7}
            </dd>
            <dt className="mt-0.5 truncate text-xs text-muted-foreground">
              Tratamientos (7 días)
              {fleet.avgTreatmentDurationMs !== null &&
                ` · prom ${formatDuration(fleet.avgTreatmentDurationMs)}`}
            </dt>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-lg bg-muted/60 px-3 py-2.5">
          <Truck className="size-4 shrink-0 text-emerald-700" />
          <div className="min-w-0">
            <dd className="text-lg font-bold tabular-nums leading-none text-foreground">
              {fleet.transfersPending}
            </dd>
            <dt className="mt-0.5 truncate text-xs text-muted-foreground">
              Traslados pendientes · {fleet.transfersCompleted} completados
            </dt>
          </div>
        </div>
      </dl>
    </section>
  )
}
