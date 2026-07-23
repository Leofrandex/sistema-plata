'use client'

import { Biohazard } from 'lucide-react'
import { cn } from '@hospiwaste/shared/lib/utils'
import { formatKg } from '@hospiwaste/shared/lib/data/dashboard-metrics'
import type { WasteTypeKgBucket } from '@hospiwaste/shared/lib/data/dashboard-analytics'
import type { WasteType } from '@hospiwaste/shared/lib/types'

/** Paleta categórica por tipo de desecho (validada CVD, orden fijo).
 *  'unclassified' es un neutro deliberado: no es una identidad, es falta de dato. */
export const WASTE_TYPE_COLORS: Record<WasteType | 'unclassified', string> = {
  infectious: '#DC2626',
  anatomopathological: '#7C3AED',
  cytotoxic: '#D97706',
  liquid: '#0284C7',
  morgue: '#059669',
  metallic: '#9F1239',
  unclassified: '#94A3B8',
}

export type WasteRange = '7d' | '30d' | 'month'

const RANGE_LABELS: Record<WasteRange, string> = {
  '7d': '7 días',
  '30d': '30 días',
  month: 'Este mes',
}

interface Props {
  buckets: WasteTypeKgBucket[]
  totalKg: number
  range: WasteRange
  onRangeChange: (range: WasteRange) => void
}

/** Kg por tipo de desecho — barras horizontales con label directo (la identidad
 *  la lleva el texto, el color es refuerzo). */
export function WasteTypeSection({ buckets, totalKg, range, onRangeChange }: Props) {
  const maxKg = buckets.length > 0 ? buckets[0].kg : 0

  return (
    <section className="rounded-2xl bg-card p-5 ring-1 ring-foreground/10">
      <header className="mb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Biohazard className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Kg por tipo de desecho
            </h2>
            <p className="text-xs text-muted-foreground/80">
              Neto recibido · total {formatKg(totalKg)}
            </p>
          </div>
        </div>
        <div className="flex rounded-lg bg-muted p-0.5" role="tablist" aria-label="Rango">
          {(Object.keys(RANGE_LABELS) as WasteRange[]).map((r) => (
            <button
              key={r}
              type="button"
              role="tab"
              aria-selected={range === r}
              onClick={() => onRangeChange(r)}
              className={cn(
                'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                range === r ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {RANGE_LABELS[r]}
            </button>
          ))}
        </div>
      </header>

      {buckets.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Sin pesajes en este rango.
        </p>
      ) : (
        <ul className="space-y-3">
          {buckets.map((b) => (
            <li key={b.type}>
              <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
                <span className="truncate text-foreground/80">{b.label}</span>
                <span className="shrink-0 tabular-nums">
                  <span className="font-semibold text-foreground">{formatKg(b.kg)}</span>{' '}
                  <span className="text-xs text-muted-foreground">({b.pct}%)</span>
                </span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-sm bg-muted">
                <div
                  className="h-full rounded-sm"
                  style={{
                    width: `${maxKg > 0 ? Math.max((b.kg / maxKg) * 100, 1) : 0}%`,
                    backgroundColor: WASTE_TYPE_COLORS[b.type],
                  }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
