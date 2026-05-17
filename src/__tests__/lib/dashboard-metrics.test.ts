import {
  computeCirculationBreakdown,
  computeDailyKg,
  computeMonthlyKgByCompany,
} from '@/lib/data/dashboard-metrics'
import {
  MOCK_CLIENTS,
  MOCK_COMPANIES,
  MOCK_CONTAINERS,
  MOCK_ROUTE_EVENTS,
  MOCK_RECEPTIONS,
  MOCK_STORAGE_EVENTS,
  MOCK_TREATMENT_RUNS,
  MOCK_EXTERNAL_TRANSFERS,
  MOCK_LOCATIONS,
} from '@/lib/mock-data'

describe('computeCirculationBreakdown', () => {
  it('returns total active containers and bucket breakdown', () => {
    const result = computeCirculationBreakdown({
      containers: MOCK_CONTAINERS,
      routeEvents: MOCK_ROUTE_EVENTS,
      receptions: MOCK_RECEPTIONS,
      storageEvents: MOCK_STORAGE_EVENTS,
      treatmentRuns: MOCK_TREATMENT_RUNS,
      externalTransfers: MOCK_EXTERNAL_TRANSFERS,
      locations: MOCK_LOCATIONS,
    })
    expect(result.total).toBe(20)
    expect(result.buckets.map((b) => b.key)).toEqual([
      'en_planta', 'en_cliente', 'en_transito', 'sin_registro',
    ])
    const sum = result.buckets.reduce((acc, b) => acc + b.count, 0)
    expect(sum).toBe(result.total)
  })

  it('classifies envases con storage abierto como en_planta', () => {
    const result = computeCirculationBreakdown({
      containers: MOCK_CONTAINERS,
      routeEvents: MOCK_ROUTE_EVENTS,
      receptions: MOCK_RECEPTIONS,
      storageEvents: MOCK_STORAGE_EVENTS,
      treatmentRuns: MOCK_TREATMENT_RUNS,
      externalTransfers: MOCK_EXTERNAL_TRANSFERS,
      locations: MOCK_LOCATIONS,
    })
    const enPlanta = result.buckets.find((b) => b.key === 'en_planta')!
    // I-001 y I-002 tienen storage abierto = 2 mínimo en planta
    expect(enPlanta.count).toBeGreaterThanOrEqual(2)
  })
})

describe('computeDailyKg', () => {
  it('sums net weight of receptions for the given day', () => {
    const result = computeDailyKg(
      {
        containers: MOCK_CONTAINERS,
        receptions: MOCK_RECEPTIONS,
        treatmentRuns: MOCK_TREATMENT_RUNS,
      },
      '2026-05-17',
    )
    // Reception I-001: 43.7 - 14.2 = 29.5
    // Reception I-002: 38.2 - 14.5 = 23.7
    // Total = 53.2
    expect(result.receivedKg).toBeCloseTo(53.2, 1)
    // No hay treatments completados hoy → todo pendiente
    expect(result.processedKg).toBe(0)
    expect(result.pendingKg).toBeCloseTo(53.2, 1)
  })

  it('returns zeros when no receptions on that day', () => {
    const result = computeDailyKg(
      {
        containers: MOCK_CONTAINERS,
        receptions: MOCK_RECEPTIONS,
        treatmentRuns: MOCK_TREATMENT_RUNS,
      },
      '2027-01-01',
    )
    expect(result.receivedKg).toBe(0)
    expect(result.processedKg).toBe(0)
    expect(result.pendingKg).toBe(0)
  })
})

describe('computeMonthlyKgByCompany', () => {
  it('groups receptions by company of the container', () => {
    const result = computeMonthlyKgByCompany(
      {
        clients: MOCK_CLIENTS,
        companies: MOCK_COMPANIES,
        containers: MOCK_CONTAINERS,
        receptions: MOCK_RECEPTIONS,
        treatmentRuns: MOCK_TREATMENT_RUNS,
      },
      '2026-05',
    )
    expect(result).toHaveLength(MOCK_COMPANIES.length)
    const ion = result.find((r) => r.company_name === 'ION')!
    const airkem = result.find((r) => r.company_name === 'Airkem')!

    // ION recibidos en mayo: I-001 (29.5) + I-002 (23.7) + I-003 (26.9) + I-006 (28.0) = ~108.1
    expect(ion.receivedKg).toBeCloseTo(108.1, 1)
    // ION procesados: treatments completados I-003 + I-006 = 26.9 + 28 = 54.9
    expect(ion.processedKg).toBeCloseTo(54.9, 1)

    // Airkem recibidos: A-002 (28.3) + A-006 (27.0) = 55.3
    expect(airkem.receivedKg).toBeCloseTo(55.3, 1)
    // Airkem procesados: A-002 + A-006 = 55.3
    expect(airkem.processedKg).toBeCloseTo(55.3, 1)
  })

  it('returns zero kg for months without activity', () => {
    const result = computeMonthlyKgByCompany(
      {
        clients: MOCK_CLIENTS,
        companies: MOCK_COMPANIES,
        containers: MOCK_CONTAINERS,
        receptions: MOCK_RECEPTIONS,
        treatmentRuns: MOCK_TREATMENT_RUNS,
      },
      '2027-01',
    )
    for (const r of result) {
      expect(r.receivedKg).toBe(0)
      expect(r.processedKg).toBe(0)
    }
  })
})
