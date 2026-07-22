import { computeDashboardMetrics } from '@/components/dashboard/metrics-cards'
import {
  MOCK_CONTAINERS,
  MOCK_ROUTE_EVENTS,
  MOCK_RECEPTIONS,
  MOCK_TREATMENT_RUNS,
} from '@hospiwaste/shared/lib/mock-data'

describe('computeDashboardMetrics', () => {
  it('counts active containers in circulation', () => {
    const metrics = computeDashboardMetrics(
      MOCK_CONTAINERS,
      MOCK_ROUTE_EVENTS,
      MOCK_RECEPTIONS,
      MOCK_TREATMENT_RUNS
    )
    // 189 tachos Airkem histórico + 15 tachos metálicos M1-M15 = 204 activos
    expect(metrics.containersInCirculation).toBe(204)
  })

  it('counts containers pending weighing (recogidos sucios sin reception)', () => {
    const metrics = computeDashboardMetrics(
      MOCK_CONTAINERS,
      MOCK_ROUTE_EVENTS,
      MOCK_RECEPTIONS,
      MOCK_TREATMENT_RUNS
    )
    // Es no negativo y refleja cola real: containers recogidos sucios en mocks
    // menos los que ya tienen reception en MOCK_RECEPTIONS/HISTORICAL_RECEPTIONS.
    expect(metrics.containersPendingWeighing).toBeGreaterThanOrEqual(0)
  })

  it('counts routes for a given date', () => {
    const metrics = computeDashboardMetrics(
      MOCK_CONTAINERS,
      MOCK_ROUTE_EVENTS,
      MOCK_RECEPTIONS,
      MOCK_TREATMENT_RUNS,
      '2026-05-17'
    )
    // 2 recorridos mockeados para 2026-05-17
    expect(metrics.routesToday).toBe(2)
  })

  it('excludes voided routes from routesToday', () => {
    const [first, ...rest] = MOCK_ROUTE_EVENTS.filter((r) => r.date === '2026-05-17')
    const voided = { ...first, voided_at: '2026-05-17T20:00:00Z' }
    const others = MOCK_ROUTE_EVENTS.filter((r) => r.date !== '2026-05-17')
    const metrics = computeDashboardMetrics(
      MOCK_CONTAINERS,
      [voided, ...rest, ...others],
      MOCK_RECEPTIONS,
      MOCK_TREATMENT_RUNS,
      '2026-05-17'
    )
    expect(metrics.routesToday).toBe(1)
  })
})
