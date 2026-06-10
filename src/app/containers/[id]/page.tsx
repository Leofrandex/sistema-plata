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
import { buildContainerWithPhase, getRouteEventIdsForContainer, formatTachoNumber } from '@/lib/data/containers'

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
    containers, clients, companies, routeEvents, receptions,
    storageEvents, treatmentRuns, externalTransfers, locations, photos,
  } = useStore()

  const container = containers.find((c) => c.id === id)
  if (!container) notFound()

  const routeIds = getRouteEventIdsForContainer(routeEvents, container.id)

  const reception = useMemo(() => {
    return [...receptions]
      .filter((r) => r.container_id === container.id && !r.voided_at)
      .sort((a, b) => new Date(b.arrived_at).getTime() - new Date(a.arrived_at).getTime())[0] ?? null
  }, [receptions, container.id])

  // El tacho es independiente: su "empresa" es la del último registro de pesaje.
  const lastCompany = reception?.company_id
    ? companies.find((c) => c.id === reception.company_id)
    : undefined

  const storage = useMemo(() => {
    return [...storageEvents]
      .filter((s) => s.container_id === container.id)
      .sort((a, b) => new Date(b.entry_at).getTime() - new Date(a.entry_at).getTime())[0] ?? null
  }, [storageEvents, container.id])

  // Tratamiento/traslado más reciente posterior a la recepción actual (incluye
  // completados). Filtrar por la recepción evita que un tratamiento de un ciclo
  // anterior marque como 'clean' un tacho re-ingresado.
  const treatment = useMemo(() => {
    const receptionAt = reception ? new Date(reception.arrived_at).getTime() : -Infinity
    return (
      [...treatmentRuns]
        .filter((t) => t.container_id === container.id && new Date(t.started_at).getTime() >= receptionAt)
        .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime())[0] ??
      [...externalTransfers]
        .filter((t) => t.container_id === container.id && new Date(t.storage_started_at).getTime() >= receptionAt)
        .sort((a, b) => new Date(b.storage_started_at).getTime() - new Date(a.storage_started_at).getTime())[0] ??
      null
    )
  }, [treatmentRuns, externalTransfers, container.id, reception])

  const containerLocations = useMemo(
    () => locations.filter((l) => l.container_id === container.id),
    [locations, container.id]
  )

  const containerWithPhase = buildContainerWithPhase(
    container, routeIds, reception, storage, treatment, containerLocations
  )

  const containerPhotoIds = [
    ...(routeEvents.flatMap((e) => {
      if (
        e.containers_dirty_received.includes(container.id) ||
        e.containers_clean_delivered.includes(container.id)
      ) {
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
          <h1 className="text-xl font-bold font-mono text-slate-800">{formatTachoNumber(container.id)}</h1>
          <p className="text-sm text-slate-500">
            Última empresa: {lastCompany?.name ?? '—'}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-slate-600">Información del tacho</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            <div>
              <dt className="text-slate-500">Número</dt>
              <dd className="font-mono font-semibold">{formatTachoNumber(container.id)}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Última empresa</dt>
              <dd className="font-medium">{lastCompany?.name ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Tipo de desecho</dt>
              <dd className="font-medium">{reception?.waste_type ? WASTE_TYPE_LABELS[reception.waste_type] : '—'}</dd>
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
                <dt className="text-slate-500">Peso neto (último)</dt>
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
            wasteType={reception?.waste_type ?? 'infectious'}
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
