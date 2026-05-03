import {
  computeContainerPhase,
  computeNetWeight,
  getContainerCurrentLocation,
} from '@/lib/data/containers'
import type {
  Container,
  ContainerReception,
  StorageEvent,
  TreatmentRun,
  ExternalTransfer,
  ContainerLocation,
} from '@/lib/types'

const baseContainer: Container = {
  id: 'A-001',
  client_id: 'client-1',
  size_liters: 240,
  tare_weight_kg: 14.2,
  waste_type: 'infectious',
  status: 'active',
  registered_at: '2026-01-01T00:00:00Z',
}

describe('computeContainerPhase', () => {
  it('returns clean when no events exist', () => {
    expect(computeContainerPhase([], null, null, null)).toBe('clean')
  })

  it('returns exchange when only exchange event exists', () => {
    const reception: ContainerReception | null = null
    const storage: StorageEvent | null = null
    const treatment: TreatmentRun | null = null
    expect(computeContainerPhase(['exchange-1'], reception, storage, treatment)).toBe('exchange')
  })

  it('returns weighing when reception exists but no storage', () => {
    const reception: ContainerReception = {
      id: 'r-1', container_id: 'A-001', batch_id: 'b-1',
      arrived_at: '2026-05-03T09:00:00Z', gross_weight_kg: 43.7,
      operator_id: 'user-1', photo_ids: [],
    }
    expect(computeContainerPhase(['exchange-1'], reception, null, null)).toBe('weighing')
  })

  it('returns cold_storage when storage event has no exit', () => {
    const reception: ContainerReception = {
      id: 'r-1', container_id: 'A-001', batch_id: 'b-1',
      arrived_at: '2026-05-03T09:00:00Z', gross_weight_kg: 43.7,
      operator_id: 'user-1', photo_ids: [],
    }
    const storage: StorageEvent = {
      id: 's-1', container_id: 'A-001', batch_id: 'b-1',
      entry_at: '2026-05-03T10:00:00Z', exit_at: null,
      operator_id: 'user-1', photo_ids: [],
    }
    expect(computeContainerPhase(['exchange-1'], reception, storage, null)).toBe('cold_storage')
  })

  it('returns clean when treatment is completed', () => {
    const reception: ContainerReception = {
      id: 'r-1', container_id: 'A-001', batch_id: 'b-1',
      arrived_at: '2026-05-03T09:00:00Z', gross_weight_kg: 43.7,
      operator_id: 'user-1', photo_ids: [],
    }
    const storage: StorageEvent = {
      id: 's-1', container_id: 'A-001', batch_id: 'b-1',
      entry_at: '2026-05-03T10:00:00Z', exit_at: '2026-05-03T14:00:00Z',
      operator_id: 'user-1', photo_ids: [],
    }
    const treatment: TreatmentRun = {
      id: 't-1', container_id: 'A-001', batch_id: 'b-1',
      started_at: '2026-05-03T14:00:00Z', completed_at: '2026-05-03T15:00:00Z',
      operator_id: 'user-1',
    }
    expect(computeContainerPhase(['exchange-1'], reception, storage, treatment)).toBe('clean')
  })
})

describe('computeNetWeight', () => {
  it('returns gross minus tare', () => {
    expect(computeNetWeight(43.7, 14.2)).toBeCloseTo(29.5)
  })
})

describe('getContainerCurrentLocation', () => {
  it('returns null when no locations exist', () => {
    expect(getContainerCurrentLocation([])).toBeNull()
  })

  it('returns the most recent location', () => {
    const locations: ContainerLocation[] = [
      { id: 'loc-1', container_id: 'A-001', reported_at: '2026-05-03T07:00:00Z', operator_id: 'user-1', location_type: 'client_site', client_id: 'client-1', floor: '2', area: 'Pediatría', notes: null },
      { id: 'loc-2', container_id: 'A-001', reported_at: '2026-05-03T09:00:00Z', operator_id: 'user-1', location_type: 'plant_storage', client_id: null, floor: null, area: null, notes: null },
    ]
    const result = getContainerCurrentLocation(locations)
    expect(result?.id).toBe('loc-2')
    expect(result?.location_type).toBe('plant_storage')
  })
})
