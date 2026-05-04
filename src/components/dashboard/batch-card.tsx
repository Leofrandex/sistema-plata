'use client'

import Link from 'next/link'
import { ArrowRight, FileText, Building2, Package, Calendar, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { BatchWithClient, ContainerPhase } from '@/lib/types'

const PHASE_LABELS: Record<ContainerPhase, string> = {
  exchange: 'Intercambio pendiente',
  weighing: 'Pesaje pendiente',
  cold_storage: 'Cámara fría',
  treatment: 'En tratamiento',
  transfer: 'Traslado pendiente',
  clean: 'Completo',
}

const PHASE_ACCENT: Record<ContainerPhase, { dot: string; pill: string; bar: string }> = {
  exchange:     { dot: 'bg-blue-500',    pill: 'bg-blue-50 text-blue-700',       bar: 'from-blue-400/40    to-blue-400/0' },
  weighing:     { dot: 'bg-amber-500',   pill: 'bg-amber-50 text-amber-700',     bar: 'from-amber-400/40   to-amber-400/0' },
  cold_storage: { dot: 'bg-cyan-500',    pill: 'bg-cyan-50 text-cyan-700',       bar: 'from-cyan-400/40    to-cyan-400/0' },
  treatment:    { dot: 'bg-violet-500',  pill: 'bg-violet-50 text-violet-700',   bar: 'from-violet-400/40  to-violet-400/0' },
  transfer:     { dot: 'bg-orange-500',  pill: 'bg-orange-50 text-orange-700',   bar: 'from-orange-400/40  to-orange-400/0' },
  clean:        { dot: 'bg-emerald-500', pill: 'bg-emerald-50 text-emerald-700', bar: 'from-emerald-400/40 to-emerald-400/0' },
}

interface Props {
  batch: BatchWithClient
  variant: 'active' | 'completed'
}

export function BatchCard({ batch, variant }: Props) {
  const isActive = variant === 'active'
  const accent = PHASE_ACCENT[batch.next_pending_step]
  const href = isActive ? `/batches/${batch.id}` : `/batches/${batch.id}/report`
  const ctaLabel = isActive ? 'Ver lote' : 'Generar reporte'
  const CtaIcon = isActive ? ArrowRight : FileText

  return (
    <Link
      href={href}
      className="group relative flex h-full flex-col overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10 transition-all hover:-translate-y-0.5 hover:shadow-lg hover:ring-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className={cn('h-1 w-full bg-gradient-to-r', isActive ? accent.bar : 'from-emerald-400/50 to-emerald-400/0')} />
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary/5 text-primary ring-1 ring-primary/10">
              <Building2 className="size-4" />
            </span>
            <span className="truncate">{batch.client.name}</span>
          </div>
          {isActive ? (
            <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium', accent.pill)}>
              <span className={cn('size-1.5 rounded-full', accent.dot)} />
              {PHASE_LABELS[batch.next_pending_step]}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
              <CheckCircle2 className="size-3" />
              Completo
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Package className="size-3.5" />
            {batch.container_count} {batch.container_count === 1 ? 'envase' : 'envases'}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Calendar className="size-3.5" />
            {batch.date}
          </span>
        </div>

        <div className="mt-auto flex items-center justify-end pt-2">
          <span className="inline-flex items-center gap-1.5 text-sm font-medium text-accent transition-colors group-hover:text-accent/80">
            {ctaLabel}
            <CtaIcon className="size-4 transition-transform group-hover:translate-x-0.5" />
          </span>
        </div>
      </div>
    </Link>
  )
}
