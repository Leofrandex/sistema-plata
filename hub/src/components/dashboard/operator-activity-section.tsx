'use client'

import { Users } from 'lucide-react'
import type { OperatorActivityRow } from '@hospiwaste/shared/lib/data/dashboard-analytics'

/** Colores del trío de actividad (validados CVD en este orden de apilado). */
const SEGMENTS = [
  { key: 'routes' as const, label: 'Recorridos', color: '#2A27E9' },
  { key: 'weighings' as const, label: 'Pesajes', color: '#D97706' },
  { key: 'treatments' as const, label: 'Tratamientos', color: '#7C3AED' },
]

interface Props {
  rows: OperatorActivityRow[]
}

/** Actividad por operador (últimos 7 días): barras apiladas con gaps y labels. */
export function OperatorActivitySection({ rows }: Props) {
  const max = rows.length > 0 ? Math.max(...rows.map((r) => r.total)) : 0

  return (
    <section className="rounded-2xl bg-card p-5 ring-1 ring-foreground/10">
      <header className="mb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Users className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Actividad por operador
            </h2>
            <p className="text-xs text-muted-foreground/80">Registros de los últimos 7 días</p>
          </div>
        </div>
      </header>

      {rows.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Sin registros en los últimos 7 días.
        </p>
      ) : (
        <>
          <ul className="space-y-3">
            {rows.map((row) => (
              <li key={row.operatorId}>
                <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
                  <span className="truncate text-foreground/80">{row.name}</span>
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                    {row.routes} rec · {row.weighings} pes · {row.treatments} trat
                  </span>
                </div>
                <div className="flex h-2.5 gap-0.5">
                  {SEGMENTS.map(({ key, color }) => {
                    const value = row[key]
                    if (value === 0 || max === 0) return null
                    return (
                      <div
                        key={key}
                        className="h-full rounded-sm"
                        style={{ width: `${(value / max) * 100}%`, backgroundColor: color }}
                        title={`${value}`}
                      />
                    )
                  })}
                </div>
              </li>
            ))}
          </ul>
          <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1 border-t border-border pt-3">
            {SEGMENTS.map(({ key, label, color }) => (
              <li key={key} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span aria-hidden className="inline-block size-2.5 rounded-sm" style={{ backgroundColor: color }} />
                {label}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}
