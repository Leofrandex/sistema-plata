'use client'

import { useState } from 'react'
import { Input } from '@hospiwaste/shared/components/ui/input'
import type { Container } from '@hospiwaste/shared/lib/types'
import { formatTachoNumber } from '@hospiwaste/shared/lib/data/containers'

export function filterContainers(containers: Container[], search: string): Container[] {
  const active = containers.filter((c) => c.status === 'active')
  if (!search.trim()) return active
  return active.filter((c) => c.id.toLowerCase().includes(search.toLowerCase()))
}

interface Props {
  containers: Container[]
  onSelect: (container: Container) => void
}

export function ContainerSelector({ containers, onSelect }: Props) {
  const [search, setSearch] = useState('')

  const results = filterContainers(containers, search).slice(0, 8)

  return (
    <div className="space-y-3">
      <Input
        placeholder="Número de tacho (ej: I-001)"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        autoFocus
        className="text-lg h-12"
      />
      {search.length > 0 && (
        <div className="space-y-2">
          {results.length === 0 && (
            <p className="text-sm text-slate-400 text-center py-4">
              No se encontró ningún tacho activo con ese número.
            </p>
          )}
          {results.map((container) => (
            <button
              key={container.id}
              onClick={() => onSelect(container)}
              className="w-full text-left p-4 rounded-lg border hover:border-blue-400 hover:bg-blue-50 transition-colors"
            >
              <p className="font-mono font-semibold text-slate-800">{formatTachoNumber(container.id)}</p>
              <p className="text-sm text-slate-500">
                {container.size_liters}L
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
