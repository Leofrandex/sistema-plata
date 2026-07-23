import {
  addDaysISO,
  computeAvgWeightPerContainer,
  computeDailyKgSeries,
  computeFleetBreakdown,
  computeKgByWasteType,
  computeMonthComparison,
  computeOperatorActivity,
  computeQualityIndicators,
  computeRouteStats,
  computeSlotComplianceToday,
  computeStagnantContainers,
  computeYearAccumulated,
  previousMonthOf,
} from '@hospiwaste/shared/lib/data/dashboard-analytics'
import type {
  Company,
  Container,
  ContainerReception,
  RouteEvent,
  TreatmentRun,
  User,
  WeighingSession,
} from '@hospiwaste/shared/lib/types'

// ─── Fixtures mínimos ────────────────────────────────────────────────────────

function makeContainer(id: string, over: Partial<Container> = {}): Container {
  return {
    id,
    size_liters: 240,
    tare_weight_kg: 10,
    status: 'active',
    registered_at: '2026-01-01T00:00:00Z',
    ...over,
  }
}

function makeReception(over: Partial<ContainerReception> & { id: string; container_id: string; arrived_at: string; gross_weight_kg: number }): ContainerReception {
  return {
    weighing_session_id: null,
    operator_id: 'op-1',
    photo_ids: [],
    observations: '',
    ...over,
  }
}

function makeRoute(over: Partial<RouteEvent> & { id: string; date: string }): RouteEvent {
  return {
    client_id: 'client-1',
    kind: 'anden',
    slot: '06:30',
    started_at: `${over.date}T06:30:00Z`,
    ended_at: `${over.date}T07:00:00Z`,
    operator_id: 'op-1',
    status: 'completed',
    containers_dirty_received: [],
    containers_clean_delivered: [],
    area: 'A',
    photo_ids: [],
    ...over,
  }
}

const CONTAINERS = [makeContainer('001'), makeContainer('002', { tare_weight_kg: 5 })]

// ─── computeKgByWasteType ────────────────────────────────────────────────────

describe('computeKgByWasteType', () => {
  const receptions: ContainerReception[] = [
    makeReception({ id: 'r1', container_id: '001', arrived_at: '2026-07-10T10:00:00Z', gross_weight_kg: 30, waste_type: 'infectious' }),
    makeReception({ id: 'r2', container_id: '002', arrived_at: '2026-07-11T10:00:00Z', gross_weight_kg: 15, waste_type: 'infectious' }),
    makeReception({ id: 'r3', container_id: '001', arrived_at: '2026-07-12T10:00:00Z', gross_weight_kg: 20 }), // sin tipo
    makeReception({ id: 'r4', container_id: '001', arrived_at: '2026-07-12T11:00:00Z', gross_weight_kg: 50, waste_type: 'metallic', voided_at: '2026-07-12T12:00:00Z' }),
    makeReception({ id: 'r5', container_id: '001', arrived_at: '2026-06-01T10:00:00Z', gross_weight_kg: 99, waste_type: 'liquid' }), // fuera de rango
  ]

  it('agrupa por tipo, manda los sin tipo a "Sin clasificar" y excluye anulados y fuera de rango', () => {
    const { buckets, totalKg } = computeKgByWasteType({ containers: CONTAINERS, receptions }, '2026-07-01', '2026-07-31')
    // infectious: (30-10) + (15-5) = 30; unclassified: 20-10 = 10
    expect(totalKg).toBe(40)
    expect(buckets).toEqual([
      { type: 'infectious', label: 'Peligroso infeccioso', kg: 30, pct: 75 },
      { type: 'unclassified', label: 'Sin clasificar', kg: 10, pct: 25 },
    ])
  })

  it('devuelve vacío sin recepciones en rango', () => {
    const { buckets, totalKg } = computeKgByWasteType({ containers: CONTAINERS, receptions }, '2025-01-01', '2025-01-31')
    expect(buckets).toEqual([])
    expect(totalKg).toBe(0)
  })
})

// ─── Serie diaria y agregados ────────────────────────────────────────────────

describe('computeDailyKgSeries', () => {
  it('devuelve un punto por día con ceros donde no hubo pesajes', () => {
    const receptions = [
      makeReception({ id: 'r1', container_id: '001', arrived_at: '2026-07-20T10:00:00Z', gross_weight_kg: 25 }),
      makeReception({ id: 'r2', container_id: '001', arrived_at: '2026-07-22T10:00:00Z', gross_weight_kg: 40 }),
    ]
    const series = computeDailyKgSeries({ containers: CONTAINERS, receptions }, '2026-07-22', 3)
    expect(series).toEqual([
      { date: '2026-07-20', kg: 15 },
      { date: '2026-07-21', kg: 0 },
      { date: '2026-07-22', kg: 30 },
    ])
  })
})

describe('computeMonthComparison / previousMonthOf / computeYearAccumulated', () => {
  const receptions = [
    makeReception({ id: 'r1', container_id: '001', arrived_at: '2026-07-05T10:00:00Z', gross_weight_kg: 40 }),
    makeReception({ id: 'r2', container_id: '001', arrived_at: '2026-06-05T10:00:00Z', gross_weight_kg: 30 }),
  ]

  it('cruza el año al calcular el mes anterior', () => {
    expect(previousMonthOf('2026-01')).toBe('2025-12')
    expect(previousMonthOf('2026-07')).toBe('2026-06')
  })

  it('compara mes actual vs anterior con delta %', () => {
    const c = computeMonthComparison({ containers: CONTAINERS, receptions }, '2026-07')
    expect(c.monthKg).toBe(30)
    expect(c.previousMonthKg).toBe(20)
    expect(c.deltaPct).toBe(50)
  })

  it('delta null cuando el mes anterior fue 0', () => {
    const c = computeMonthComparison({ containers: CONTAINERS, receptions }, '2026-06')
    expect(c.deltaPct).toBeNull()
  })

  it('acumula los 12 meses del año', () => {
    const y = computeYearAccumulated({ containers: CONTAINERS, receptions }, '2026')
    expect(y.months).toHaveLength(12)
    expect(y.months[5]).toEqual({ month: '2026-06', kg: 20 })
    expect(y.months[6]).toEqual({ month: '2026-07', kg: 30 })
    expect(y.totalKg).toBe(50)
  })
})

describe('computeAvgWeightPerContainer', () => {
  it('promedia el neto por recepción y devuelve null sin datos', () => {
    const receptions = [
      makeReception({ id: 'r1', container_id: '001', arrived_at: '2026-07-05T10:00:00Z', gross_weight_kg: 40 }),
      makeReception({ id: 'r2', container_id: '002', arrived_at: '2026-07-06T10:00:00Z', gross_weight_kg: 15 }),
    ]
    expect(computeAvgWeightPerContainer({ containers: CONTAINERS, receptions }, '2026-07-01', '2026-07-31')).toBe(20)
    expect(computeAvgWeightPerContainer({ containers: CONTAINERS, receptions }, '2025-01-01', '2025-01-31')).toBeNull()
  })
})

// ─── computeStagnantContainers ───────────────────────────────────────────────

describe('computeStagnantContainers', () => {
  it('ordena por duración desc, excluye en_planta y respeta topN', () => {
    const now = new Date('2026-07-22T12:00:00Z').getTime()
    const containers = [makeContainer('001'), makeContainer('002'), makeContainer('003')]
    const routeEvents: RouteEvent[] = [
      // 001 entregado limpio hace 5 días → en_cliente
      makeRoute({ id: 'e1', date: '2026-07-17', started_at: '2026-07-17T12:00:00Z', containers_clean_delivered: ['001'] }),
      // 002 recogido sucio hace 2 días → pendiente_pesar
      makeRoute({ id: 'e2', date: '2026-07-20', started_at: '2026-07-20T12:00:00Z', containers_dirty_received: ['002'] }),
    ]
    // 003 sin eventos → en_planta (excluido)
    const rows = computeStagnantContainers(
      { containers, routeEvents, receptions: [], treatmentRuns: [], externalTransfers: [] },
      now,
      5,
    )
    expect(rows.map((r) => r.id)).toEqual(['001', '002'])
    expect(rows[0].bucket).toBe('en_cliente')
    expect(rows[0].durationMs).toBe(5 * 24 * 3600 * 1000)

    const top1 = computeStagnantContainers(
      { containers, routeEvents, receptions: [], treatmentRuns: [], externalTransfers: [] },
      now,
      1,
    )
    expect(top1).toHaveLength(1)
  })
})

// ─── Recorridos ──────────────────────────────────────────────────────────────

describe('computeSlotComplianceToday', () => {
  it('marca completados y pendientes de los 6 slots', () => {
    const routeEvents = [
      makeRoute({ id: 'e1', date: '2026-07-22', slot: '06:30' }),
      makeRoute({ id: 'e2', date: '2026-07-22', slot: '10:30', status: 'in_progress', ended_at: null }),
    ]
    const c = computeSlotComplianceToday(routeEvents, '2026-07-22')
    expect(c.total).toBe(6)
    expect(c.completed).toBe(1)
    expect(c.slots[0].status).toBe('completed')
    expect(c.slots[1].status).toBe('in_progress')
    expect(c.slots[2].status).toBe('available')
  })
})

describe('computeRouteStats', () => {
  it('cuenta semana actual vs anterior, split andén/morgue y promedios', () => {
    const routeEvents = [
      makeRoute({ id: 'e1', date: '2026-07-22', containers_dirty_received: ['001', '002'], containers_clean_delivered: ['003'] }),
      makeRoute({ id: 'e2', date: '2026-07-20', kind: 'morgue', slot: null }),
      makeRoute({ id: 'e3', date: '2026-07-10' }), // semana anterior
      makeRoute({ id: 'e4', date: '2026-07-21', voided_at: '2026-07-21T20:00:00Z' }), // anulado
    ]
    const s = computeRouteStats(routeEvents, '2026-07-22')
    expect(s.last7Count).toBe(2)
    expect(s.prev7Count).toBe(1)
    expect(s.anden7).toBe(1)
    expect(s.morgue7).toBe(1)
    expect(s.avgDirtyPerRoute).toBe(1)
    expect(s.avgCleanPerRoute).toBe(0.5)
  })
})

// ─── Operadores ──────────────────────────────────────────────────────────────

describe('computeOperatorActivity', () => {
  it('agrupa por operador con nombre resuelto y ordena por total', () => {
    const users: User[] = [{ id: 'op-1', name: 'Ana Pérez' }]
    const routeEvents = [
      makeRoute({ id: 'e1', date: '2026-07-22', operator_id: 'op-1' }),
      makeRoute({ id: 'e2', date: '2026-07-22', operator_id: 'op-2' }),
    ]
    const receptions = [
      makeReception({ id: 'r1', container_id: '001', arrived_at: '2026-07-22T10:00:00Z', gross_weight_kg: 20, operator_id: 'op-1' }),
    ]
    const treatmentRuns: TreatmentRun[] = [
      { id: 't1', container_id: '001', started_at: '2026-07-22T11:00:00Z', completed_at: '2026-07-22T12:00:00Z', operator_id: 'op-1' },
      { id: 't2', container_id: '002', started_at: '2026-07-22T11:00:00Z', completed_at: null, operator_id: 'op-2' }, // en curso: no cuenta
    ]
    const rows = computeOperatorActivity({ users, routeEvents, receptions, treatmentRuns }, '2026-07-22', '2026-07-22')
    expect(rows[0]).toEqual({ operatorId: 'op-1', name: 'Ana Pérez', routes: 1, weighings: 1, treatments: 1, total: 3 })
    expect(rows[1].name).toBe('op-2') // sin perfil: cae al id
    expect(rows[1].total).toBe(1)
  })
})

// ─── Calidad ─────────────────────────────────────────────────────────────────

describe('computeQualityIndicators', () => {
  it('junta observaciones, anulaciones y recorridos sin firma/fotos', () => {
    const receptions = [
      makeReception({ id: 'r1', container_id: '001', arrived_at: '2026-07-21T10:00:00Z', gross_weight_kg: 20, observations: 'Tacho dañado' }),
      makeReception({ id: 'r2', container_id: '001', arrived_at: '2026-07-20T10:00:00Z', gross_weight_kg: 20, voided_at: '2026-07-20T11:00:00Z', void_reason: 'peso mal digitado' }),
    ]
    const routeEvents = [
      makeRoute({ id: 'e1', date: '2026-07-21', signature_photo_id: 'p1', dirty_photo_ids: ['p2'] }),
      makeRoute({ id: 'e2', date: '2026-07-22' }), // sin firma ni fotos
    ]
    const weighingSessions: WeighingSession[] = []
    const q = computeQualityIndicators({ routeEvents, receptions, weighingSessions }, '2026-07-16')
    expect(q.observations).toHaveLength(1)
    expect(q.observations[0].observations).toBe('Tacho dañado')
    expect(q.voided).toEqual([
      { kind: 'pesaje', id: 'r2', voidedAt: '2026-07-20T11:00:00Z', reason: 'peso mal digitado' },
    ])
    expect(q.routesConsidered).toBe(2)
    expect(q.routesWithoutSignature).toBe(1)
    expect(q.routesWithoutPhotos).toBe(1)
  })
})

// ─── Flota ───────────────────────────────────────────────────────────────────

describe('computeFleetBreakdown', () => {
  it('desglosa por tamaño y empresa, cuenta tratamientos y traslados', () => {
    const companies: Company[] = [{ id: 'c-a', client_id: 'cl', name: 'Airkem', code_letter: 'A' }]
    const containers = [
      makeContainer('001'),
      makeContainer('002', { size_liters: 750 }),
      makeContainer('003', { status: 'decommissioned' }),
      makeContainer('Y1', { is_yaris_container: true }), // fuera del pool
    ]
    const routeEvents = [
      makeRoute({ id: 'e1', date: '2026-07-22', company_id: 'c-a', containers_dirty_received: ['001'] }),
    ]
    const treatmentRuns: TreatmentRun[] = [
      { id: 't1', container_id: '001', started_at: '2026-07-22T10:00:00Z', completed_at: '2026-07-22T11:00:00Z', operator_id: 'op-1' },
      { id: 't2', container_id: '002', started_at: '2026-07-01T10:00:00Z', completed_at: '2026-07-01T12:00:00Z', operator_id: 'op-1' }, // fuera de los 7 días
    ]
    const externalTransfers = [
      { id: 'x1', container_id: '002', storage_started_at: '2026-07-20T10:00:00Z', transferred_at: null, destination: 'D', operator_id: 'op-1' },
      { id: 'x2', container_id: '001', storage_started_at: '2026-07-10T10:00:00Z', transferred_at: '2026-07-11T10:00:00Z', destination: 'D', operator_id: 'op-1' },
    ]
    const f = computeFleetBreakdown(
      { companies, containers, routeEvents, receptions: [], treatmentRuns, externalTransfers },
      '2026-07-22',
    )
    expect(f.activeCount).toBe(2)
    expect(f.decommissionedCount).toBe(1)
    expect(f.bySize).toEqual([
      { size: 240, count: 1 },
      { size: 750, count: 1 },
    ])
    const airkem = f.byCompany.find((c) => c.companyId === 'c-a')
    expect(airkem?.count).toBe(1)
    expect(airkem?.companyName).toBe('Airkem')
    expect(f.treatmentsCompleted7).toBe(1)
    expect(f.avgTreatmentDurationMs).toBe(1.5 * 3600 * 1000)
    expect(f.transfersPending).toBe(1)
    expect(f.transfersCompleted).toBe(1)
  })
})

// ─── addDaysISO ──────────────────────────────────────────────────────────────

describe('addDaysISO', () => {
  it('cruza meses y años', () => {
    expect(addDaysISO('2026-07-01', -1)).toBe('2026-06-30')
    expect(addDaysISO('2026-01-01', -1)).toBe('2025-12-31')
    expect(addDaysISO('2026-07-22', 9)).toBe('2026-07-31')
  })
})
