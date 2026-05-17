'use client'

import Link from 'next/link'
import { Clock, CheckCircle2, Play } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useElapsed, formatElapsed } from '@/hooks/use-elapsed'
import type { RouteSlotDefinition } from '@/lib/constants'

export type RouteSlotStatus = 'available' | 'in_progress' | 'completed'

interface Props {
  slot: RouteSlotDefinition
  status: RouteSlotStatus
  // Solo en in_progress: timestamp para mostrar elapsed live
  startedAt?: string | null
  // Solo en completed: información del recorrido cerrado
  completedAt?: string | null
}

const STATUS_LABEL: Record<RouteSlotStatus, string> = {
  available: 'Disponible',
  in_progress: 'En curso',
  completed: 'Completado',
}

export function RouteSlotCard({ slot, status, startedAt, completedAt }: Props) {
  const elapsed = useElapsed(status === 'in_progress' ? startedAt ?? null : null)
  const href = `/register/route/${encodeURIComponent(slot.id)}`
  const clickable = status !== 'completed'

  const content = (
    <div
      className={cn(
        'group relative overflow-hidden rounded-xl p-5 ring-1 transition-all',
        status === 'available' && 'bg-card ring-foreground/10 hover:ring-accent hover:-translate-y-0.5 hover:shadow-md',
        status === 'in_progress' && 'bg-accent/5 ring-accent/40 shadow-sm',
        status === 'completed' && 'bg-muted/30 ring-foreground/10 opacity-70 cursor-not-allowed',
      )}
    >
      {/* Decoración blur del estado */}
      <div
        aria-hidden
        className={cn(
          'pointer-events-none absolute -top-12 -right-12 size-32 rounded-full blur-2xl',
          status === 'available' && 'bg-accent/10',
          status === 'in_progress' && 'bg-accent/30',
          status === 'completed' && 'bg-emerald-500/10',
        )}
      />

      <div className="relative flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={cn(
              'flex h-12 w-12 shrink-0 items-center justify-center rounded-lg ring-1 ring-foreground/5',
              status === 'available' && 'bg-accent/10 text-accent',
              status === 'in_progress' && 'bg-accent text-white',
              status === 'completed' && 'bg-emerald-100 text-emerald-700',
            )}
          >
            {status === 'completed' ? (
              <CheckCircle2 className="h-5 w-5" />
            ) : status === 'in_progress' ? (
              <Play className="h-5 w-5" />
            ) : (
              <Clock className="h-5 w-5" />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-base font-semibold text-foreground">
              {slot.ordinal} ruta
            </p>
            <p className="text-sm text-muted-foreground">
              Horario fijo {slot.shortLabel}
            </p>
          </div>
        </div>

        <div className="text-right shrink-0">
          <p
            className={cn(
              'text-xs font-semibold uppercase tracking-wide',
              status === 'available' && 'text-muted-foreground',
              status === 'in_progress' && 'text-accent',
              status === 'completed' && 'text-emerald-700',
            )}
          >
            {STATUS_LABEL[status]}
          </p>
          {status === 'in_progress' && (
            <p className="text-lg font-bold tabular-nums text-foreground">
              {formatElapsed(elapsed)}
            </p>
          )}
          {status === 'completed' && completedAt && (
            <p className="text-xs text-muted-foreground">
              {new Date(completedAt).toLocaleTimeString('es-PA', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          )}
        </div>
      </div>
    </div>
  )

  if (!clickable) return content
  return <Link href={href} aria-label={`Abrir ${slot.ordinal} ruta`}>{content}</Link>
}
