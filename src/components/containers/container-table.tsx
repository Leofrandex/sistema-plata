'use client'

import { useRouter } from 'next/navigation'
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
  const router = useRouter()
  const clientMap = Object.fromEntries(clients.map((c) => [c.id, c.name]))

  if (containers.length === 0) {
    return (
      <div className="rounded-xl bg-card p-12 text-center text-muted-foreground ring-1 ring-foreground/10">
        No se encontraron envases.
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-xl bg-card ring-1 ring-foreground/10">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <th className="px-4 py-3">Envase</th>
            <th className="px-4 py-3">Cliente</th>
            <th className="px-4 py-3">Tipo</th>
            <th className="px-4 py-3">Tamaño</th>
            <th className="px-4 py-3">Fase actual</th>
            <th className="px-4 py-3">Ubicación actual</th>
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
            const href = `/containers/${c.id}`

            return (
              <tr
                key={c.id}
                tabIndex={0}
                aria-label={`Ver envase ${c.id}`}
                onClick={() => {
                  if (typeof window !== 'undefined' && window.getSelection()?.toString()) return
                  router.push(href)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    router.push(href)
                  }
                }}
                className="cursor-pointer transition-colors outline-none hover:bg-accent/5 focus-visible:bg-accent/10 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
              >
                <td className="px-4 py-3">
                  <Link
                    href={href}
                    onClick={(e) => e.stopPropagation()}
                    className="font-mono font-semibold text-accent hover:underline"
                  >
                    {c.id}
                  </Link>
                </td>
                <td className="px-4 py-3 text-foreground/80">{clientMap[c.client_id] ?? '—'}</td>
                <td className="px-4 py-3 text-foreground/80">{WASTE_LABELS[c.waste_type]}</td>
                <td className="px-4 py-3 text-foreground/80">{c.size_liters} L</td>
                <td className="px-4 py-3">
                  <Badge variant="outline">{PHASE_LABELS[c.current_phase]}</Badge>
                </td>
                <td className="px-4 py-3 max-w-xs truncate text-muted-foreground">{locationText}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
