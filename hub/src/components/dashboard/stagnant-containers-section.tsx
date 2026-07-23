'use client'

import Link from 'next/link'
import { Hourglass } from 'lucide-react'
import {
  circulationColor,
  circulationLabel,
  formatDuration,
} from '@hospiwaste/shared/lib/data/dashboard-metrics'
import { formatTachoNumber } from '@hospiwaste/shared/lib/data/containers'
import type { StagnantContainer } from '@hospiwaste/shared/lib/data/dashboard-analytics'

interface Props {
  rows: StagnantContainer[]
}

/** Top de tachos con más tiempo en su estado actual (fuera de planta). */
export function StagnantContainersSection({ rows }: Props) {
  return (
    <section className="rounded-2xl bg-card p-5 ring-1 ring-foreground/10">
      <header className="mb-4 flex items-center gap-2.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
          <Hourglass className="h-4 w-4" />
        </div>
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Tachos estancados
          </h2>
          <p className="text-xs text-muted-foreground/80">Más tiempo sin avanzar de estado</p>
        </div>
      </header>

      {rows.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Ningún tacho fuera de planta. Todo al día.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {rows.map((row) => (
            <li key={row.id}>
              <Link
                href={`/containers/detail?id=${encodeURIComponent(row.id)}`}
                className="flex items-center gap-3 py-2.5 text-sm transition-colors hover:bg-muted/40 rounded-md px-1 -mx-1"
              >
                <span className="font-semibold tabular-nums text-foreground">
                  {formatTachoNumber(row.id)}
                </span>
                <span className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
                  <span
                    aria-hidden
                    className="inline-block size-2 shrink-0 rounded-full"
                    style={{ backgroundColor: circulationColor(row.bucket) }}
                  />
                  <span className="truncate text-xs">{circulationLabel(row.bucket)}</span>
                </span>
                <span className="ml-auto shrink-0 font-semibold tabular-nums text-foreground">
                  {formatDuration(row.durationMs)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
