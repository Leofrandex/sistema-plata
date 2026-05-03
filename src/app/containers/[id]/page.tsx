'use client'

import { use, useMemo } from 'react'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ContainerLifeline } from '@/components/containers/container-lifeline'
import { PhaseMetrics } from '@/components/containers/phase-metrics'
import { LocationHistory } from '@/components/containers/location-history'
import { PhasePhotoGallery } from '@/components/containers/phase-photo-gallery'
import { useStore } from '@/lib/store'
import { buildContainerWithPhase } from '@/lib/data/containers'

const WASTE_TYPE_LABELS: Record<string, string> = {
  infectious: 'Peligroso infeccioso',
  anatomopathological: 'Anatomopatológico',
  cytotoxic: 'Citotóxico',
  liquid: 'Líquidos',
  morgue: 'Morgue',
}

interface Props {
  params: Promise<{ id: string }>
}

export default function ContainerDetailPage({ params }: Props) {
  const { id } = use(params)
  const {
    containers, clients, exchangeEvents, receptions,
    storageEvents, treatmentRuns, externalTransfers, locations, photos,
  } = useStore()

  const container = containers.find((c) => c.id === id)
  if (!container) notFound()

  const client = clients.find((c) => c.id === container.client_id)!

  const exchangeIds = exchangeEvents
    .filter((e) => e.dirty_containers_received.includes(container.id))
    .map((e) => e.id)

  const reception = useMemo(() => {
    return [...receptions]
      .filter((r) => r.container_id === container.id)
      .sort((a, b) => new Date(b.arrived_at).getTime() - new Date(a.arrived_at).getTime())[0] ?? null
  }, [receptions, container.id])

  const storage = useMemo(() => {
    return [...storageEvents]
      .filter((s) => s.container_id === container.id)
      .sort((a, b) => new Date(b.entry_at).getTime() - new Date(a.entry_at).getTime())[0] ?? null
  }, [storageEvents, container.id])

  const treatment = useMemo(() => {
    return treatmentRuns.find((t) => t.container_id === container.id)
      ?? externalTransfers.find((t) => t.container_id === container.id)
      ?? null
  }, [treatmentRuns, externalTransfers, container.id])

  const containerLocations = useMemo(
    () => locations.filter((l) => l.container_id === container.id),
    [locations, container.id]
  )

  const containerWithPhase = buildContainerWithPhase(
    container, exchangeIds, reception, storage, treatment, containerLocations
  )

  const containerPhotoIds = [
    ...(exchangeEvents.flatMap((e) => {
      if (e.dirty_containers_received.includes(container.id) || e.clean_containers_given.includes(container.id)) {
        return e.photo_ids
      }
      return []
    })),
    ...(reception?.photo_ids ?? []),
    ...(storage?.photo_ids ?? []),
  ]
  const containerPhotos = photos.filter((p) => containerPhotoIds.includes(p.id))

  const clientNameMap = Object.fromEntries(clients.map((c) => [c.id, c.name]))

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <Link href="/containers">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-xl font-bold font-mono text-slate-800">{container.id}</h1>
          <p className="text-sm text-slate-500">{client.name}</p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-slate-600">Información del envase</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            <div>
              <dt className="text-slate-500">Número</dt>
              <dd className="font-mono font-semibold">{container.id}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Cliente</dt>
              <dd className="font-medium">{client.name}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Tipo de desecho</dt>
              <dd className="font-medium">{WASTE_TYPE_LABELS[container.waste_type]}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Tamaño</dt>
              <dd className="font-medium">{container.size_liters} L</dd>
            </div>
            <div>
              <dt className="text-slate-500">Tara</dt>
              <dd className="font-medium">{container.tare_weight_kg} kg</dd>
            </div>
            {containerWithPhase.latest_net_weight_kg !== null && (
              <div>
                <dt className="text-slate-500">Peso neto (último lote)</dt>
                <dd className="font-semibold text-slate-800">{containerWithPhase.latest_net_weight_kg} kg</dd>
              </div>
            )}
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-slate-600">Línea de vida</CardTitle>
        </CardHeader>
        <CardContent>
          <ContainerLifeline
            currentPhase={containerWithPhase.current_phase}
            wasteType={container.waste_type}
          />
        </CardContent>
      </Card>

      <PhaseMetrics
        reception={reception}
        storage={storage}
        treatmentOrTransfer={treatment}
      />

      <div>
        <h3 className="text-sm font-semibold text-slate-600 mb-3">Historial de ubicaciones</h3>
        <LocationHistory locations={containerLocations} clientNames={clientNameMap} />
      </div>

      <div>
        <h3 className="text-sm font-semibold text-slate-600 mb-3">Registro fotográfico</h3>
        <PhasePhotoGallery photos={containerPhotos} />
      </div>
    </div>
  )
}
