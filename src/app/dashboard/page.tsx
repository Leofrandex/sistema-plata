'use client'

import { useMemo } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { MetricsCards, computeDashboardMetrics } from '@/components/dashboard/metrics-cards'
import { ActiveBatchesTab } from '@/components/dashboard/active-batches-tab'
import { CompletedBatchesTab } from '@/components/dashboard/completed-batches-tab'
import { useStore } from '@/lib/store'
import { computeNextPendingStep } from '@/lib/data/batches'
import { computeContainerPhase } from '@/lib/data/containers'
import type { BatchWithClient } from '@/lib/types'

export default function DashboardPage() {
  const {
    batches, clients, containers, storageEvents, treatmentRuns,
    exchangeEvents, receptions, externalTransfers,
  } = useStore()

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

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-800">Dashboard</h1>
      <MetricsCards metrics={metrics} />
      <Tabs defaultValue="active">
        <TabsList>
          <TabsTrigger value="active">
            Lotes activos ({activeBatches.length})
          </TabsTrigger>
          <TabsTrigger value="completed">
            Lotes completados ({completedBatches.length})
          </TabsTrigger>
        </TabsList>
        <TabsContent value="active" className="mt-4">
          <ActiveBatchesTab batches={activeBatches} />
        </TabsContent>
        <TabsContent value="completed" className="mt-4">
          <CompletedBatchesTab
            batches={completedBatches}
            clients={clients.map((c) => ({ id: c.id, name: c.name }))}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
