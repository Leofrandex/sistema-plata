'use client'

import { use, useMemo } from 'react'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ReportPreview } from '@/components/reports/report-preview'
import { useStore } from '@/lib/store'
import type { ContainerReception, Photo } from '@/lib/types'

interface Props {
  params: Promise<{ id: string }>
}

export default function BatchReportPage({ params }: Props) {
  const { id } = use(params)
  const { batches, clients, containers, exchangeEvents, receptions, storageEvents, photos } = useStore()

  const batch = batches.find((b) => b.id === id)
  if (!batch) notFound()

  const client = clients.find((c) => c.id === batch.client_id)!

  const containerData = useMemo(() => {
    return batch.container_ids.map((cid) => {
      const container = containers.find((c) => c.id === cid)!

      const reception: ContainerReception | null = [...receptions]
        .filter((r) => r.container_id === cid && r.batch_id === batch.id)
        .sort((a, b) => new Date(b.arrived_at).getTime() - new Date(a.arrived_at).getTime())[0] ?? null

      const containerExchangeEvents = exchangeEvents.filter(
        (e) => (e.dirty_containers_received.includes(cid) || e.clean_containers_given.includes(cid)) && e.batch_id === batch.id
      )
      const exchangePhotoIds = containerExchangeEvents.flatMap((e) => e.photo_ids)

      const containerStorage = storageEvents.find((s) => s.container_id === cid && s.batch_id === batch.id)
      const storagePhotoIds = containerStorage?.photo_ids ?? []

      const weighingPhotoIds = reception?.photo_ids ?? []

      const getPhotos = (ids: string[]): Photo[] =>
        ids.map((pid) => photos.find((p) => p.id === pid)).filter((p): p is Photo => !!p)

      return {
        container,
        reception,
        exchangePhotos: getPhotos(exchangePhotoIds),
        weighingPhotos: getPhotos(weighingPhotoIds),
        storagePhotos: getPhotos(storagePhotoIds),
      }
    })
  }, [batch, containers, exchangeEvents, receptions, storageEvents, photos])

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/batches/${batch.id}`}>
          <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div>
          <h1 className="text-xl font-bold text-slate-800">Generar Reporte</h1>
          <p className="text-sm text-slate-500">{client.name} · {batch.date}</p>
        </div>
      </div>
      <ReportPreview batch={batch} client={client} containerData={containerData} />
    </div>
  )
}
