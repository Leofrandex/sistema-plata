'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import type { ContainerWithPhase, ContainerPhase } from '@/lib/types'
import { formatTachoNumber } from '@/lib/data/containers'

const PHASE_LABELS: Record<ContainerPhase, string> = {
  route: 'Recorrido',
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
  companies: { id: string; name: string; client_id: string }[]
  clients: { id: string; name: string }[]
}

export function ContainerTable({ containers, companies, clients }: Props) {
  const router = useRouter()
  const companyMap = Object.fromEntries(companies.map((c) => [c.id, c]))
  const clientMap = Object.fromEntries(clients.map((c) => [c.id, c.name]))

  if (containers.length === 0) {
    return (
      <div className="rounded-xl bg-card p-12 text-center text-muted-foreground ring-1 ring-foreground/10">
        No se encontraron tachos.
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-xl bg-card ring-1 ring-foreground/10">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <th className="px-4 py-3">Tacho</th>
            <th className="px-4 py-3">Empresa</th>
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
            const company = companyMap[c.company_id]
            const clientName = company ? clientMap[company.client_id] ?? '—' : '—'

            return (
              <tr
                key={c.id}
                tabIndex={0}
                aria-label={`Ver tacho ${formatTachoNumber(c.id)}`}
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
                    {formatTachoNumber(c.id)}
                  </Link>
                </td>
                <td className="px-4 py-3 text-foreground/80">{company?.name ?? '—'}</td>
                <td className="px-4 py-3 text-foreground/80">{clientName}</td>
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
