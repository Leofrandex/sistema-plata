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
// routeEventIds: IDs de RouteEvents donde el envase fue recogido sucio
// (containers_dirty_received). Solo los recogidos sucios disparan fase 'route';
// los entregados limpios no afectan la fase del envase.
// - Recogido sucio sin recepción → 'route'
// - Recepción sin storage → 'weighing'
// - Storage sin exit → 'cold_storage'
// - Tratamiento/traslado activo → 'treatment' o 'transfer'
// - Todo cerrado → 'clean'
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

// Ayudante: obtiene los IDs de RouteEvents donde el envase fue recogido sucio.
// Esto es lo que determina si está en fase 'route' (a la espera de pesaje).
// Los envases entregados limpios NO disparan fase 'route' — siguen su fase actual.
export function getRouteEventIdsForContainer(
  routeEvents: RouteEvent[],
  containerId: string
): string[] {
  return routeEvents
    .filter((r) => r.containers_dirty_received.includes(containerId))
    .map((r) => r.id)
}

// Variante que considera ambos lados del recorrido. Útil para reportes y vistas
// históricas donde queremos mostrar todo el ciclo (limpio entregado + sucio recogido).
export function getRouteEventIdsAnyDirection(
  routeEvents: RouteEvent[],
  containerId: string
): string[] {
  return routeEvents
    .filter((r) =>
      r.containers_dirty_received.includes(containerId) ||
      r.containers_clean_delivered.includes(containerId),
    )
    .map((r) => r.id)
}

// Cola de trabajo del pesador: envases activos recogidos sucios en algún
// recorrido que aún no tienen reception registrada.
export function getPendingWeighingContainerIds(
  containers: Container[],
  routeEvents: RouteEvent[],
  receptions: ContainerReception[]
): string[] {
  const pesadosIds = new Set(receptions.map((r) => r.container_id))
  return containers
    .filter((c) => {
      if (c.status !== 'active') return false
      if (pesadosIds.has(c.id)) return false
      return getRouteEventIdsForContainer(routeEvents, c.id).length > 0
    })
    .map((c) => c.id)
}

/**
 * Display del número de tacho sin el prefijo de empresa (artefacto histórico de
 * importación). 'A-001' → '001'. Ids sin prefijo se devuelven igual.
 */
export function formatTachoNumber(id: string): string {
  return id.replace(/^[A-Za-z]+-/, '')
}
