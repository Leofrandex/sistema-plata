'use client'

import { use, useMemo } from 'react'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { BatchContainersList } from '@/components/batches/batch-containers-list'
import { useStore } from '@/lib/store'
import { buildContainerWithPhase } from '@/lib/data/containers'
import type { ContainerWithPhase } from '@/lib/types'

interface Props {
  params: Promise<{ id: string }>
}

export default function BatchDetailPage({ params }: Props) {
  const { id } = use(params)
  const {
    batches, clients, containers, exchangeEvents,
    receptions, storageEvents, treatmentRuns, externalTransfers, locations,
  } = useStore()

  const batch = batches.find((b) => b.id === id)
  if (!batch) notFound()

  const client = clients.find((c) => c.id === batch.client_id)!

  const batchContainers: ContainerWithPhase[] = useMemo(() => {
    return batch.container_ids
      .map((cid) => {
        const container = containers.find((c) => c.id === cid)
        if (!container) return null

        const exchangeIds = exchangeEvents
          .filter((e) => e.dirty_containers_received.includes(cid) && e.batch_id === batch.id)
          .map((e) => e.id)
        const reception = receptions.find((r) => r.container_id === cid && r.batch_id === batch.id) ?? null
        const storage = storageEvents.find((s) => s.container_id === cid && s.batch_id === batch.id) ?? null
        const treatment = treatmentRuns.find((t) => t.container_id === cid && t.batch_id === batch.id)
          ?? externalTransfers.find((t) => t.container_id === cid && t.batch_id === batch.id)
          ?? null
        const containerLocations = locations.filter((l) => l.container_id === cid)

        return buildContainerWithPhase(container, exchangeIds, reception, storage, treatment, containerLocations)
      })
      .filter((c): c is ContainerWithPhase => c !== null)
  }, [batch, containers, exchangeEvents, receptions, storageEvents, treatmentRuns, externalTransfers, locations])

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-slate-800">{client.name}</h1>
          <p className="text-sm text-slate-500">Lote {batch.date} · {batchContainers.length} envases</p>
        </div>
        <Link href={`/batches/${batch.id}/report`}>
          <Button variant="outline" size="sm" className="gap-2">
            <FileText className="h-4 w-4" />
            Generar reporte
          </Button>
        </Link>
      </div>
      <BatchContainersList containers={batchContainers} />
    </div>
  )
}
