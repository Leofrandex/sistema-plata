'use client'

import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import type { ContainerWithPhase, ContainerPhase } from '@/lib/types'

const PHASE_LABELS: Record<ContainerPhase, string> = {
  exchange: 'Intercambio',
  weighing: 'Pesaje',
  cold_storage: 'Cámara fría',
  treatment: 'Tratamiento',
  transfer: 'Traslado',
  clean: 'Limpio',
}

const WASTE_LABELS: Record<string, string> = {
  infectious: 'Infeccioso',
  anatomopathological: 'Anatomopatológico',
  cytotoxic: 'Citotóxico',
  liquid: 'Líquidos',
  morgue: 'Morgue',
}

interface Props {
  containers: ContainerWithPhase[]
  clients: { id: string; name: string }[]
}

export function ContainerTable({ containers, clients }: Props) {
  const clientMap = Object.fromEntries(clients.map((c) => [c.id, c.name]))

  if (containers.length === 0) {
    return <div className="text-center py-12 text-slate-400">No se encontraron envases.</div>
  }

  return (
    <div className="overflow-x-auto rounded-lg border bg-white">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-slate-50 text-slate-500 text-left">
            <th className="px-4 py-3 font-medium">Envase</th>
            <th className="px-4 py-3 font-medium">Cliente</th>
            <th className="px-4 py-3 font-medium">Tipo</th>
            <th className="px-4 py-3 font-medium">Tamaño</th>
            <th className="px-4 py-3 font-medium">Fase actual</th>
            <th className="px-4 py-3 font-medium">Ubicación actual</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {containers.map((c) => {
            const loc = c.current_location
            const locationText = loc
              ? loc.location_type === 'client_site'
                ? `${clientMap[loc.client_id ?? ''] ?? ''} · Piso ${loc.floor} — ${loc.area}`
                : loc.location_type.replace('_', ' ')
              : '—'

            return (
              <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3">
                  <Link
                    href={`/containers/${c.id}`}
                    className="font-mono font-semibold text-blue-600 hover:underline"
                  >
                    {c.id}
                  </Link>
                </td>
                <td className="px-4 py-3 text-slate-600">{clientMap[c.client_id] ?? '—'}</td>
                <td className="px-4 py-3 text-slate-600">{WASTE_LABELS[c.waste_type]}</td>
                <td className="px-4 py-3 text-slate-600">{c.size_liters} L</td>
                <td className="px-4 py-3">
                  <Badge variant="outline">{PHASE_LABELS[c.current_phase]}</Badge>
                </td>
                <td className="px-4 py-3 text-slate-500 max-w-xs truncate">{locationText}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
