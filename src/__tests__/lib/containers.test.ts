import {
  computeContainerPhase,
  computeNetWeight,
  getContainerCurrentLocation,
  getRouteEventIdsForContainer,
} from '@/lib/data/containers'
import type {
  Container,
  ContainerReception,
  StorageEvent,
  TreatmentRun,
  ContainerLocation,
  RouteEvent,
} from '@/lib/types'

const baseContainer: Container = {
  id: 'I-001',
  company_id: 'company-ion',
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

  it('returns route when only route event exists', () => {
    const reception: ContainerReception | null = null
    const storage: StorageEvent | null = null
    const treatment: TreatmentRun | null = null
    expect(computeContainerPhase(['route-1'], reception, storage, treatment)).toBe('route')
  })

  it('returns weighing when reception exists but no storage', () => {
    const reception: ContainerReception = {
      id: 'r-1', container_id: 'I-001', weighing_session_id: null,
      arrived_at: '2026-05-03T09:00:00Z', gross_weight_kg: 43.7,
      operator_id: 'user-1', photo_ids: [], observations: '',
    }
    expect(computeContainerPhase(['route-1'], reception, null, null)).toBe('weighing')
  })

  it('returns cold_storage when storage event has no exit', () => {
    const reception: ContainerReception = {
      id: 'r-1', container_id: 'I-001', weighing_session_id: null,
      arrived_at: '2026-05-03T09:00:00Z', gross_weight_kg: 43.7,
      operator_id: 'user-1', photo_ids: [], observations: '',
    }
    const storage: StorageEvent = {
      id: 's-1', container_id: 'I-001',
      entry_at: '2026-05-03T10:00:00Z', exit_at: null,
      operator_id: 'user-1', photo_ids: [],
    }
    expect(computeContainerPhase(['route-1'], reception, storage, null)).toBe('cold_storage')
  })

  it('returns clean when treatment is completed', () => {
    const reception: ContainerReception = {
      id: 'r-1', container_id: 'I-001', weighing_session_id: null,
      arrived_at: '2026-05-03T09:00:00Z', gross_weight_kg: 43.7,
      operator_id: 'user-1', photo_ids: [], observations: '',
    }
    const storage: StorageEvent = {
      id: 's-1', container_id: 'I-001',
      entry_at: '2026-05-03T10:00:00Z', exit_at: '2026-05-03T14:00:00Z',
      operator_id: 'user-1', photo_ids: [],
    }
    const treatment: TreatmentRun = {
      id: 't-1', container_id: 'I-001',
      started_at: '2026-05-03T14:00:00Z', completed_at: '2026-05-03T15:00:00Z',
      operator_id: 'user-1',
    }
    expect(computeContainerPhase(['route-1'], reception, storage, treatment)).toBe('clean')
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
      { id: 'loc-1', container_id: 'I-001', reported_at: '2026-05-03T07:00:00Z', operator_id: 'user-1', location_type: 'client_site', client_id: 'client-1', floor: '2', area: 'Pediatría', notes: null },
      { id: 'loc-2', container_id: 'I-001', reported_at: '2026-05-03T09:00:00Z', operator_id: 'user-1', location_type: 'plant_storage', client_id: null, floor: null, area: null, notes: null },
    ]
    const result = getContainerCurrentLocation(locations)
    expect(result?.id).toBe('loc-2')
    expect(result?.location_type).toBe('plant_storage')
  })
})

describe('getRouteEventIdsForContainer', () => {
  const baseRoute: Omit<RouteEvent, 'id' | 'containers_dirty_received' | 'containers_clean_delivered'> = {
    client_id: 'client-1',
    kind: 'anden',
    slot: '06:30',
    date: '2026-05-17',
    started_at: '2026-05-17T06:30:00Z',
    ended_at: '2026-05-17T08:00:00Z',
    operator_id: 'user-1',
    status: 'completed',
    floor: '1', area: 'Emergencias', dock: 'Norte',
    photo_ids: [],
  }

  it('returns route ids where the container was received as dirty', () => {
    const events: RouteEvent[] = [
      { ...baseRoute, id: 'route-1', containers_dirty_received: ['I-001', 'I-002'], containers_clean_delivered: [] },
      { ...baseRoute, id: 'route-2', slot: '10:30', containers_dirty_received: ['A-001'], containers_clean_delivered: [] },
      { ...baseRoute, id: 'route-3', slot: '13:20', containers_dirty_received: ['I-001'], containers_clean_delivered: [] },
    ]
    expect(getRouteEventIdsForContainer(events, 'I-001')).toEqual(['route-1', 'route-3'])
  })

  it('does NOT return route ids where container was only delivered clean', () => {
    const events: RouteEvent[] = [
      { ...baseRoute, id: 'route-1', containers_dirty_received: [], containers_clean_delivered: ['I-001'] },
    ]
    // I-001 entregado limpio NO debe disparar fase 'route'
    expect(getRouteEventIdsForContainer(events, 'I-001')).toEqual([])
  })

  it('returns empty array when no route includes the container', () => {
    expect(getRouteEventIdsForContainer([], 'I-001')).toEqual([])
  })
})

// Keep baseContainer referenced so import isn't pruned
void baseContainer
