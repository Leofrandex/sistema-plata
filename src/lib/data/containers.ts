import type {
  Container,
  ContainerLocation,
  ContainerPhase,
  ContainerReception,
  ContainerWithPhase,
  StorageEvent,
  TreatmentRun,
  ExternalTransfer,
  RouteEvent,
} from '@/lib/types'

export function computeNetWeight(
  gross_weight_kg: number,
  tare_weight_kg: number
): number {
  return Math.round((gross_weight_kg - tare_weight_kg) * 100) / 100
}

export function getContainerCurrentLocation(
  locations: ContainerLocation[]
): ContainerLocation | null {
  if (locations.length === 0) return null
  return [...locations].sort(
    (a, b) => new Date(b.reported_at).getTime() - new Date(a.reported_at).getTime()
  )[0]
}

// Determina la fase actual del envase en su ciclo de vida.
// routeEventIds: IDs de RouteEvents donde el envase aparece en containers_exchanged.
// Si tiene recorrido pero no recepción → 'route'
// Si tiene recepción pero no entró a cámara fría → 'weighing'
// Si está en cámara fría sin salir → 'cold_storage'
// Si tiene tratamiento/traslado activo → 'treatment' o 'transfer'
// Si todo está cerrado → 'clean'
export function computeContainerPhase(
  routeEventIds: string[],
  reception: ContainerReception | null,
  storage: StorageEvent | null,
  treatmentOrTransfer: TreatmentRun | ExternalTransfer | null
): ContainerPhase {
  if (!reception && routeEventIds.length === 0) return 'clean'
  if (!reception) return 'route'
  if (!storage) return 'weighing'
  if (!storage.exit_at) return 'cold_storage'
  if (!treatmentOrTransfer) return 'cold_storage'
  if ('completed_at' in treatmentOrTransfer) {
    return treatmentOrTransfer.completed_at ? 'clean' : 'treatment'
  }
  return (treatmentOrTransfer as ExternalTransfer).transferred_at ? 'clean' : 'transfer'
}

export function buildContainerWithPhase(
  container: Container,
  routeEventIds: string[],
  reception: ContainerReception | null,
  storage: StorageEvent | null,
  treatmentOrTransfer: TreatmentRun | ExternalTransfer | null,
  locations: ContainerLocation[]
): ContainerWithPhase {
  return {
    ...container,
    current_phase: computeContainerPhase(routeEventIds, reception, storage, treatmentOrTransfer),
    current_location: getContainerCurrentLocation(locations),
    latest_net_weight_kg: reception
      ? computeNetWeight(reception.gross_weight_kg, container.tare_weight_kg)
      : null,
  }
}

// Ayudante: obtiene los IDs de RouteEvents donde aparece un envase.
export function getRouteEventIdsForContainer(
  routeEvents: RouteEvent[],
  containerId: string
): string[] {
  return routeEvents
    .filter((r) => r.containers_exchanged.includes(containerId))
    .map((r) => r.id)
}
