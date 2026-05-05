'use client'

import { useMemo, useState } from 'react'
import { MetricsCards, computeDashboardMetrics } from '@/components/dashboard/metrics-cards'
import { DashboardHero } from '@/components/dashboard/dashboard-hero'
import { BatchStatusToggle, type BatchStatusValue } from '@/components/dashboard/batch-status-toggle'
import { BatchCard } from '@/components/dashboard/batch-card'
import { CompletedBatchesFilters } from '@/components/dashboard/completed-batches-filters'
import { useStore } from '@/lib/store'
import { computeNextPendingStep } from '@/lib/data/batches'
import { computeContainerPhase } from '@/lib/data/containers'
import type { BatchWithClient } from '@/lib/types'

export default function DashboardPage() {
  const {
    batches, clients, containers, storageEvents, treatmentRuns,
    exchangeEvents, receptions, externalTransfers,
  } = useStore()

  const [statusView, setStatusView] = useState<BatchStatusValue>('active')
  const [clientFilter, setClientFilter] = useState<string>('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const metrics = useMemo(
    () => computeDashboardMetrics(batches, containers, storageEvents, treatmentRuns),
    [batches, containers, storageEvents, treatmentRuns]
  )

  const enrichBatch = (batch: typeof batches[0]): BatchWithClient => {
    const client = clients.find((c) => c.id === batch.client_id)!
    const batchContainers = containers.filter((c) => batch.container_ids.includes(c.id))
    const phases = batchContainers.map((container) => {
      const exchangeIds = exchangeEvents
        .filter((e) => e.dirty_containers_received.includes(container.id) && e.batch_id === batch.id)
        .map((e) => e.id)
      const reception = receptions.find((r) => r.container_id === container.id && r.batch_id === batch.id) ?? null
      const storage = storageEvents.find((s) => s.container_id === container.id && s.batch_id === batch.id) ?? null
      const treatment = treatmentRuns.find((t) => t.container_id === container.id && t.batch_id === batch.id)
        ?? externalTransfers.find((t) => t.container_id === container.id && t.batch_id === batch.id)
        ?? null
      return computeContainerPhase(exchangeIds, reception, storage, treatment)
    })
    return {
      ...batch,
      client,
      next_pending_step: computeNextPendingStep(phases),
      container_count: batch.container_ids.length,
    }
  }

  const activeBatches = useMemo(
    () => batches.filter((b) => b.status === 'active').map(enrichBatch),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [batches, clients, containers, exchangeEvents, receptions, storageEvents, treatmentRuns, externalTransfers]
  )

  const completedBatches = useMemo(
    () => batches.filter((b) => b.status === 'completed').map(enrichBatch),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [batches, clients, containers, exchangeEvents, receptions, storageEvents, treatmentRuns, externalTransfers]
  )

  const completedFiltered = useMemo(
    () => completedBatches.filter((b) => {
      if (clientFilter !== 'all' && b.client_id !== clientFilter) return false
      if (dateFrom && b.date < dateFrom) return false
      if (dateTo && b.date > dateTo) return false
      return true
    }),
    [completedBatches, clientFilter, dateFrom, dateTo]
  )

  const visible = statusView === 'active' ? activeBatches : completedFiltered
  const emptyText = statusView === 'active'
    ? 'No hay lotes activos hoy.'
    : 'No hay lotes completados con esos filtros.'

  return (
    <div className="space-y-6">
      <DashboardHero />
      <MetricsCards metrics={metrics} />

      <section className="space-y-4">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Lotes</h2>
            <p className="text-sm text-muted-foreground">
              Accede al detalle del lote o al reporte final.
            </p>
          </div>
          <BatchStatusToggle
            value={statusView}
            onChange={setStatusView}
            activeCount={activeBatches.length}
            completedCount={completedBatches.length}
          />
        </header>

        {statusView === 'completed' && (
          <CompletedBatchesFilters
            clients={clients.map((c) => ({ id: c.id, name: c.name }))}
            clientFilter={clientFilter}
            dateFrom={dateFrom}
            dateTo={dateTo}
            onClientChange={setClientFilter}
            onDateFromChange={setDateFrom}
            onDateToChange={setDateTo}
          />
        )}

        {visible.length === 0 ? (
          <div className="rounded-xl bg-card p-12 text-center text-muted-foreground ring-1 ring-foreground/10">
            {emptyText}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {visible.map((batch) => (
              <BatchCard key={batch.id} batch={batch} variant={statusView} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
