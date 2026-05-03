'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ChevronRight } from 'lucide-react'
import type { BatchWithClient, ContainerPhase } from '@/lib/types'

const PHASE_LABELS: Record<ContainerPhase, string> = {
  exchange: 'Intercambio pendiente',
  weighing: 'Pesaje pendiente',
  cold_storage: 'Cámara fría',
  treatment: 'En tratamiento',
  transfer: 'Traslado pendiente',
  clean: 'Completo',
}

const PHASE_COLORS: Record<ContainerPhase, string> = {
  exchange: 'bg-blue-100 text-blue-700',
  weighing: 'bg-yellow-100 text-yellow-700',
  cold_storage: 'bg-cyan-100 text-cyan-700',
  treatment: 'bg-purple-100 text-purple-700',
  transfer: 'bg-orange-100 text-orange-700',
  clean: 'bg-green-100 text-green-700',
}

interface Props {
  batches: BatchWithClient[]
}

export function ActiveBatchesTab({ batches }: Props) {
  if (batches.length === 0) {
    return (
      <div className="text-center py-12 text-slate-400">
        No hay lotes activos hoy.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {batches.map((batch) => (
        <div
          key={batch.id}
          className="flex items-center justify-between p-4 bg-white rounded-lg border hover:border-slate-300 transition-colors"
        >
          <div className="space-y-1">
            <p className="font-medium text-slate-800">{batch.client.name}</p>
            <p className="text-sm text-slate-500">
              {batch.container_count} envases · {batch.date}
            </p>
            <span
              className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${PHASE_COLORS[batch.next_pending_step]}`}
            >
              {PHASE_LABELS[batch.next_pending_step]}
            </span>
          </div>
          <Link href={`/batches/${batch.id}`}>
            <Button variant="ghost" size="icon">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      ))}
    </div>
  )
}
