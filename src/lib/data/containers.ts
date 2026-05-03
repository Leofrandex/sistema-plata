import type {
  Container,
  ContainerLocation,
  ContainerPhase,
  ContainerReception,
  ContainerWithPhase,
  StorageEvent,
  TreatmentRun,
  ExternalTransfer,
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

// Determines which phase a container is currently in.
// exchangeEventIds: IDs of ExchangeEvents where this container appears in dirty_containers_received.
export function computeContainerPhase(
  exchangeEventIds: string[],
  reception: ContainerReception | null,
  storage: StorageEvent | null,
  treatmentOrTransfer: TreatmentRun | ExternalTransfer | null
): ContainerPhase {
  if (!reception && exchangeEventIds.length === 0) return 'clean'
  if (!reception) return 'exchange'
  if (!storage) return 'weighing'
  if (!storage.exit_at) return 'cold_storage'
  if (!treatmentOrTransfer) return 'cold_storage' // exited storage but no treatment yet
  if ('completed_at' in treatmentOrTransfer) {
    // TreatmentRun
    return treatmentOrTransfer.completed_at ? 'clean' : 'treatment'
  }
  // ExternalTransfer
  return (treatmentOrTransfer as ExternalTransfer).transferred_at ? 'clean' : 'transfer'
}

export function buildContainerWithPhase(
  container: Container,
  exchangeEventIds: string[],
  reception: ContainerReception | null,
  storage: StorageEvent | null,
  treatmentOrTransfer: TreatmentRun | ExternalTransfer | null,
  locations: ContainerLocation[]
): ContainerWithPhase {
  return {
    ...container,
    current_phase: computeContainerPhase(exchangeEventIds, reception, storage, treatmentOrTransfer),
    current_location: getContainerCurrentLocation(locations),
    latest_net_weight_kg: reception
      ? computeNetWeight(reception.gross_weight_kg, container.tare_weight_kg)
      : null,
  }
}
