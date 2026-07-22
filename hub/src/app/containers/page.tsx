'use client'

import { useState, useMemo, useEffect } from 'react'
import { ContainerFilters } from '@/components/containers/container-filters'
import { ContainerTable, type TachoRow } from '@/components/containers/container-table'
import { useStore } from '@hospiwaste/shared/lib/store'
import { deriveContainerCompanyId } from '@hospiwaste/shared/lib/data/containers'
import { computeCirculationStatus } from '@hospiwaste/shared/lib/data/dashboard-metrics'
import type { ContainerFilters as Filters } from '@/components/containers/container-filters'

const DEFAULT_FILTERS: Filters = {
  search: '',
  size: 'all',
  company: 'all',
  phase: 'all',
}

export default function ContainersPage() {
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS)
  const [now, setNow] = useState(() => Date.now())
  const {
    containers, companies, routeEvents, receptions, treatmentRuns, externalTransfers,
  } = useStore()

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(id)
  }, [])

  const rows: TachoRow[] = useMemo(() => {
    const timeline = { routeEvents, receptions, treatmentRuns, externalTransfers }
    return containers
      .filter((c) => c.status === 'active')
      .map((container) => {
        const { bucket, sinceMs } = computeCirculationStatus(container, timeline)
        return {
          id: container.id,
          size_liters: container.size_liters,
          bucket,
          sinceMs,
          company_id: deriveContainerCompanyId(container.id, routeEvents, receptions),
        }
      })
  }, [containers, routeEvents, receptions, treatmentRuns, externalTransfers])

  const filtered = useMemo(() => {
    return rows.filter((c) => {
      if (filters.search && !c.id.toLowerCase().includes(filters.search.toLowerCase())) return false
      if (filters.size !== 'all' && c.size_liters !== filters.size) return false
      if (filters.company !== 'all' && c.company_id !== filters.company) return false
      if (filters.phase !== 'all' && c.bucket !== filters.phase) return false
      return true
    })
  }, [rows, filters])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">Inventario de Tachos</h1>
        <span className="text-sm text-slate-500">{filtered.length} tachos</span>
      </div>
      <ContainerFilters
        filters={filters}
        onChange={setFilters}
        companies={companies.map((c) => ({ id: c.id, name: c.name }))}
      />
      <ContainerTable rows={filtered} now={now} />
    </div>
  )
}
