import {
  computeContainerPhase,
  computeNetWeight,
  getContainerCurrentLocation,
  getRouteEventIdsForContainer,
  getContainerCurrentCompanyId,
  getMetallicContainers,
  getPendingWeighingContainerIds,
  deriveContainerCompanyId,
} from '@/lib/data/containers'
import type {
  Container,
  ContainerReception,
  StorageEvent,
  TreatmentRun,
  ContainerLocation,
  RouteEvent,
  ExternalTransfer,
} from '@/lib/types'

const baseContainer: Container = {
  id: 'I-001',
  company_id: 'company-ion',
  size_liters: 240,
  tare_weight_kg: 14.2,
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
    area: 'Emergencias',
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

  it('ignora recorridos anulados (voided_at)', () => {
    const events: RouteEvent[] = [
      { ...baseRoute, id: 'route-1', containers_dirty_received: ['I-001'], containers_clean_delivered: [] },
      { ...baseRoute, id: 'route-2', containers_dirty_received: ['I-001'], containers_clean_delivered: [], voided_at: '2026-05-18T00:00:00Z', voided_by: 'op', void_reason: 'error' },
    ]
    expect(getRouteEventIdsForContainer(events, 'I-001')).toEqual(['route-1'])
  })
})

describe('getContainerCurrentCompanyId', () => {
  function mkRoute(partial: Partial<RouteEvent>): RouteEvent {
    return {
      id: 'r', client_id: 'cl', company_id: null, kind: 'anden', slot: '06:30',
      date: '2026-05-29', started_at: '2026-05-29T06:30:00Z', ended_at: null,
      operator_id: 'op', status: 'completed',
      containers_dirty_received: [], containers_clean_delivered: [],
      area: '', photo_ids: [],
      ...partial,
    }
  }

  it('devuelve la empresa del recorrido abierto que recogió el tacho', () => {
    const routes = [mkRoute({ id: 'r1', company_id: 'ion', started_at: '2026-05-29T06:00:00Z', containers_dirty_received: ['A-007'] })]
    expect(getContainerCurrentCompanyId('A-007', routes, [], [])).toBe('ion')
  })

  it('null si no hay recorrido que lo haya recogido', () => {
    expect(getContainerCurrentCompanyId('A-007', [], [], [])).toBeNull()
  })

  it('null tras tratamiento completado (ciclo cerrado)', () => {
    const routes = [mkRoute({ id: 'r1', company_id: 'ion', started_at: '2026-05-29T06:00:00Z', containers_dirty_received: ['A-007'] })]
    const treatments: TreatmentRun[] = [
      { id: 't1', container_id: 'A-007', started_at: '2026-05-29T10:00:00Z', completed_at: '2026-05-29T10:05:00Z', operator_id: 'op' },
    ]
    expect(getContainerCurrentCompanyId('A-007', routes, treatments, [])).toBeNull()
  })

  it('toma el recorrido más reciente posterior al último tratamiento (ION→Airkem)', () => {
    const routes = [
      mkRoute({ id: 'r1', company_id: 'ion', started_at: '2026-05-29T06:00:00Z', containers_dirty_received: ['A-007'] }),
      mkRoute({ id: 'r2', company_id: 'airkem', started_at: '2026-05-30T06:00:00Z', containers_dirty_received: ['A-007'] }),
    ]
    const treatments: TreatmentRun[] = [
      { id: 't1', container_id: 'A-007', started_at: '2026-05-29T10:00:00Z', completed_at: '2026-05-29T10:05:00Z', operator_id: 'op' },
    ]
    expect(getContainerCurrentCompanyId('A-007', routes, treatments, [])).toBe('airkem')
  })
})

describe('computeContainerPhase — tratamiento inmediato', () => {
  const reception: ContainerReception = {
    id: 'rec', container_id: 'A-007', weighing_session_id: 's', arrived_at: '2026-05-29T09:00:00Z',
    gross_weight_kg: 40, operator_id: 'op', photo_ids: [], observations: '',
    company_id: 'ion', waste_type: 'infectious', treat_immediately: true,
  }
  it('tratamiento completado sin storage → clean', () => {
    const treatment: TreatmentRun = { id: 't', container_id: 'A-007', started_at: '2026-05-29T09:01:00Z', completed_at: '2026-05-29T09:01:00Z', operator_id: 'op' }
    expect(computeContainerPhase(['r1'], reception, null, treatment)).toBe('clean')
  })
  it('tratamiento en curso sin storage → treatment', () => {
    const treatment: TreatmentRun = { id: 't', container_id: 'A-007', started_at: '2026-05-29T09:01:00Z', completed_at: null, operator_id: 'op' }
    expect(computeContainerPhase(['r1'], reception, null, treatment)).toBe('treatment')
  })
})

describe('getMetallicContainers', () => {
  const mk = (id: string, over: Partial<Container> = {}): Container => ({
    id,
    company_id: '',
    size_liters: 120,
    tare_weight_kg: 8.7,
    status: 'active',
    registered_at: '2026-06-01T00:00:00Z',
    ...over,
  })

  it('devuelve solo los dedicados a metálico y activos', () => {
    const list = [
      mk('M1', { is_metallic_dedicated: true }),
      mk('M2', { is_metallic_dedicated: true, status: 'decommissioned' }),
      mk('A-020', { size_liters: 240, is_yaris_dedicated: true }),
      mk('A-001', { size_liters: 240 }),
    ]
    expect(getMetallicContainers(list).map((c) => c.id)).toEqual(['M1'])
  })

  it('lista vacía → []', () => {
    expect(getMetallicContainers([])).toEqual([])
  })
})

describe('getPendingWeighingContainerIds', () => {
  const c = (id: string, over: Partial<Container> = {}): Container => ({
    id, company_id: 'ion', size_liters: 240, tare_weight_kg: 14,
    status: 'active', registered_at: '2026-01-01T00:00:00Z', ...over,
  })
  const routeWith = (...ids: string[]): RouteEvent => ({
    id: 're-1', client_id: 'cli', kind: 'anden', slot: '06:30', date: '2026-06-03',
    started_at: '2026-06-03T06:30:00Z', ended_at: null, operator_id: 'op',
    status: 'in_progress', floor: '', area: '', dock: '',
    containers_dirty_received: ids, containers_clean_delivered: [],
  } as unknown as RouteEvent)
  const rec = (containerId: string, over: Partial<ContainerReception> = {}): ContainerReception => ({
    id: `rec-${containerId}`, container_id: containerId, weighing_session_id: 's',
    arrived_at: '2026-06-03T09:00:00Z', gross_weight_kg: 40, operator_id: 'op',
    photo_ids: [], observations: '', ...over,
  })

  it('incluye tachos activos recogidos sucios sin recepción', () => {
    const containers = [c('001'), c('002')]
    const result = getPendingWeighingContainerIds(containers, [routeWith('001')], [])
    expect(result).toEqual(['001'])
  })

  it('excluye un tacho ya pesado (con recepción vigente)', () => {
    const containers = [c('001')]
    const result = getPendingWeighingContainerIds(containers, [routeWith('001')], [rec('001')])
    expect(result).toEqual([])
  })

  it('una recepción anulada (voided) devuelve el tacho a pendiente', () => {
    const containers = [c('001')]
    const voided = rec('001', { voided_at: '2026-06-03T10:00:00Z', voided_by: 'op', void_reason: 'peso mal tecleado' })
    const result = getPendingWeighingContainerIds(containers, [routeWith('001')], [voided])
    expect(result).toEqual(['001'])
  })

  it('excluye contenedores Yaris recogidos sucios (no se pesan directamente)', () => {
    const containers = [c('001'), c('Y1', { is_yaris_container: true, tare_weight_kg: 0 })]
    const result = getPendingWeighingContainerIds(containers, [routeWith('001', 'Y1')], [])
    expect(result).toEqual(['001'])
  })

  it('un recorrido anulado devuelve el tacho fuera de pendientes', () => {
    const containers = [c('001')]
    const voidedRoute = { ...routeWith('001'), voided_at: '2026-06-03T10:00:00Z' } as RouteEvent
    const result = getPendingWeighingContainerIds(containers, [voidedRoute], [])
    expect(result).toEqual([])
  })
})

describe('deriveContainerCompanyId', () => {
  const route = (over: Partial<RouteEvent>): RouteEvent => ({
    id: 'r', client_id: 'cl', company_id: 'company-ion', kind: 'anden', slot: '06:30',
    date: '2026-06-10', started_at: '2026-06-10T06:30:00Z', ended_at: null,
    operator_id: 'op', status: 'completed',
    containers_dirty_received: [], containers_clean_delivered: [], area: '', photo_ids: [], ...over,
  })
  const rec = (over: Partial<ContainerReception>): ContainerReception => ({
    id: 'rec', container_id: '001', weighing_session_id: 's', arrived_at: '2026-06-11T09:00:00Z',
    gross_weight_kg: 40, operator_id: 'op', photo_ids: [], observations: '', ...over,
  })

  it('sin registros → null', () => {
    expect(deriveContainerCompanyId('001', [], [])).toBeNull()
  })

  it('gana el registro más reciente con company_id', () => {
    const routes = [route({ id: 'r1', started_at: '2026-06-10T06:30:00Z', company_id: 'company-airkem', containers_dirty_received: ['001'] })]
    const recs = [rec({ id: 'rec1', arrived_at: '2026-06-12T09:00:00Z', company_id: 'company-ion' })]
    expect(deriveContainerCompanyId('001', routes, recs)).toBe('company-ion')
  })

  it('ignora registros anulados y sin company_id', () => {
    const routes = [route({ id: 'r1', started_at: '2026-06-13T06:30:00Z', company_id: 'company-airkem', containers_clean_delivered: ['001'] })]
    const recs = [rec({ id: 'rec1', arrived_at: '2026-06-14T09:00:00Z', company_id: 'company-ion', voided_at: '2026-06-15T00:00:00Z' })]
    expect(deriveContainerCompanyId('001', routes, recs)).toBe('company-airkem')
  })
})

// Keep baseContainer referenced so import isn't pruned
void baseContainer
