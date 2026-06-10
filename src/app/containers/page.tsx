'use client'

import { useState, useMemo } from 'react'
import { ContainerFilters } from '@/components/containers/container-filters'
import { ContainerTable } from '@/components/containers/container-table'
import { useStore } from '@/lib/store'
import { buildContainerWithPhase, getRouteEventIdsForContainer } from '@/lib/data/containers'
import type { ContainerFilters as Filters } from '@/components/containers/container-filters'
import type { ContainerWithPhase } from '@/lib/types'

const DEFAULT_FILTERS: Filters = {
  search: '',
  size: 'all',
}

export default function ContainersPage() {
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS)
  const {
    containers, clients, routeEvents, receptions,
    storageEvents, treatmentRuns, externalTransfers, locations,
  } = useStore()

  const allContainersWithPhase: ContainerWithPhase[] = useMemo(() => {
    return containers
      .filter((c) => c.status === 'active')
      .map((container) => {
        const routeIds = getRouteEventIdsForContainer(routeEvents, container.id)
        const reception = [...receptions]
          .filter((r) => r.container_id === container.id && !r.voided_at)
          .sort((a, b) => new Date(b.arrived_at).getTime() - new Date(a.arrived_at).getTime())[0] ?? null
        const storage = [...storageEvents]
          .filter((s) => s.container_id === container.id)
          .sort((a, b) => new Date(b.entry_at).getTime() - new Date(a.entry_at).getTime())[0] ?? null
        // Tratamiento/traslado más reciente posterior a la recepción actual (incluye
        // completados). Un tratamiento inmediato se crea con started_at == completed_at,
        // así que filtrar por `!t.completed_at` lo ignoraba y el tacho seguía mostrándose
        // como cold_storage en vez de clean. Ver decisions/2026-05-21-estado-envase-derivado.md.
        const receptionAt = reception ? new Date(reception.arrived_at).getTime() : -Infinity
        const treatment =
          [...treatmentRuns]
            .filter((t) => t.container_id === container.id && new Date(t.started_at).getTime() >= receptionAt)
            .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime())[0] ??
          [...externalTransfers]
            .filter((t) => t.container_id === container.id && new Date(t.storage_started_at).getTime() >= receptionAt)
            .sort((a, b) => new Date(b.storage_started_at).getTime() - new Date(a.storage_started_at).getTime())[0] ??
          null
        const containerLocations = locations.filter((l) => l.container_id === container.id)
        return buildContainerWithPhase(container, routeIds, reception, storage, treatment, containerLocations)
      })
  }, [containers, routeEvents, receptions, storageEvents, treatmentRuns, externalTransfers, locations])

  const filtered = useMemo(() => {
    return allContainersWithPhase.filter((c) => {
      if (filters.search && !c.id.toLowerCase().includes(filters.search.toLowerCase())) return false
      if (filters.size !== 'all' && c.size_liters !== filters.size) return false
      return true
    })
  }, [allContainersWithPhase, filters])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">Inventario de Tachos</h1>
        <span className="text-sm text-slate-500">{filtered.length} tachos</span>
      </div>
      <ContainerFilters
        filters={filters}
        onChange={setFilters}
      />
      <ContainerTable
        containers={filtered}
        clients={clients.map((c) => ({ id: c.id, name: c.name }))}
      />
    </div>
  )
}
