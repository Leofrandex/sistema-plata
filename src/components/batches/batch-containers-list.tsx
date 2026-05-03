'use client'

import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { ChevronRight } from 'lucide-react'
import type { ContainerWithPhase, ContainerPhase } from '@/lib/types'

const PHASE_LABELS: Record<ContainerPhase, string> = {
  exchange: 'Intercambio',
  weighing: 'Pesaje',
  cold_storage: 'Cámara fría',
  treatment: 'Tratamiento',
  transfer: 'Traslado',
  clean: 'Limpio',
}

const PHASE_VARIANTS: Record<ContainerPhase, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  exchange: 'default',
  weighing: 'secondary',
  cold_storage: 'secondary',
  treatment: 'default',
  transfer: 'default',
  clean: 'outline',
}

const WASTE_TYPE_LABELS: Record<string, string> = {
  infectious: 'Infeccioso',
  anatomopathological: 'Anatomopat.',
  cytotoxic: 'Citotóxico',
  liquid: 'Líquidos',
  morgue: 'Morgue',
}

interface Props {
  containers: ContainerWithPhase[]
}

export function BatchContainersList({ containers }: Props) {
  return (
    <div className="space-y-2">
      {containers.map((container) => (
        <Link
          key={container.id}
          href={`/containers/${container.id}`}
          className="flex items-center justify-between p-4 bg-white rounded-lg border hover:border-slate-300 transition-colors"
        >
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-mono font-semibold text-slate-800">{container.id}</span>
              <Badge variant={PHASE_VARIANTS[container.current_phase]}>
                {PHASE_LABELS[container.current_phase]}
              </Badge>
            </div>
            <p className="text-sm text-slate-500">
              {WASTE_TYPE_LABELS[container.waste_type]} · {container.size_liters}L
              {container.latest_net_weight_kg !== null && (
                <> · <strong>{container.latest_net_weight_kg} kg netos</strong></>
              )}
            </p>
            {container.current_location && (
              <p className="text-xs text-slate-400">
                {container.current_location.location_type === 'client_site'
                  ? `Piso ${container.current_location.floor} — ${container.current_location.area}`
                  : container.current_location.location_type}
              </p>
            )}
          </div>
          <ChevronRight className="h-4 w-4 text-slate-400 shrink-0" />
        </Link>
      ))}
    </div>
  )
}
