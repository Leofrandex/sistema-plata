'use client'

import { ShieldCheck, PenOff, ImageOff, Ban, MessageSquareText } from 'lucide-react'
import { formatTachoNumber } from '@hospiwaste/shared/lib/data/containers'
import type { QualityIndicators } from '@hospiwaste/shared/lib/data/dashboard-analytics'

const DATETIME_FORMATTER = new Intl.DateTimeFormat('es-PA', {
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
})

interface Props {
  indicators: QualityIndicators
  windowLabel: string // ej: "últimos 7 días"
}

/** Calidad del registro: firmas/fotos faltantes, anulaciones y observaciones. */
export function QualitySection({ indicators, windowLabel }: Props) {
  const { observations, voided, routesWithoutSignature, routesWithoutPhotos, routesConsidered } = indicators

  return (
    <section className="rounded-2xl bg-card p-5 ring-1 ring-foreground/10">
      <header className="mb-4 flex items-center gap-2.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-100 text-green-700">
          <ShieldCheck className="h-4 w-4" />
        </div>
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Calidad del registro
          </h2>
          <p className="text-xs text-muted-foreground/80">
            {routesConsidered} recorridos en los {windowLabel}
          </p>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex items-center gap-3 rounded-lg bg-muted/60 px-3 py-2.5">
          <PenOff className="size-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <p className="text-lg font-bold tabular-nums leading-none text-foreground">
              {routesWithoutSignature}
            </p>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">Recorridos sin firma</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-lg bg-muted/60 px-3 py-2.5">
          <ImageOff className="size-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <p className="text-lg font-bold tabular-nums leading-none text-foreground">
              {routesWithoutPhotos}
            </p>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">Recorridos sin fotos</p>
          </div>
        </div>
      </div>

      {voided.length > 0 && (
        <div className="mt-4">
          <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <Ban className="size-3.5" /> Anulaciones recientes
          </h3>
          <ul className="space-y-1.5">
            {voided.map((v) => (
              <li key={`${v.kind}-${v.id}`} className="flex items-baseline gap-2 text-sm">
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                  {DATETIME_FORMATTER.format(new Date(v.voidedAt))}
                </span>
                <span className="shrink-0 rounded bg-red-50 px-1.5 py-0.5 text-[11px] font-medium text-red-700">
                  {v.kind}
                </span>
                <span className="truncate text-foreground/80" title={v.reason}>
                  {v.reason || 'Sin motivo'}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {observations.length > 0 && (
        <div className="mt-4">
          <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <MessageSquareText className="size-3.5" /> Observaciones de pesaje
          </h3>
          <ul className="space-y-1.5">
            {observations.map((o) => (
              <li key={o.receptionId} className="flex items-baseline gap-2 text-sm">
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                  {DATETIME_FORMATTER.format(new Date(o.arrivedAt))}
                </span>
                <span className="shrink-0 font-semibold tabular-nums text-foreground">
                  {formatTachoNumber(o.containerId)}
                </span>
                <span className="truncate text-foreground/80" title={o.observations}>
                  {o.observations}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {voided.length === 0 && observations.length === 0 && (
        <p className="mt-4 text-center text-sm text-muted-foreground">
          Sin anulaciones ni observaciones en los {windowLabel}.
        </p>
      )}
    </section>
  )
}
