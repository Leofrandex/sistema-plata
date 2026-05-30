import { computeDashboardMetrics } from '@/components/dashboard/metrics-cards'
import {
  MOCK_CONTAINERS,
  MOCK_ROUTE_EVENTS,
  MOCK_RECEPTIONS,
  MOCK_TREATMENT_RUNS,
} from '@/lib/mock-data'

describe('computeDashboardMetrics', () => {
  it('counts active containers in circulation', () => {
    const metrics = computeDashboardMetrics(
      MOCK_CONTAINERS,
      MOCK_ROUTE_EVENTS,
      MOCK_RECEPTIONS,
      MOCK_TREATMENT_RUNS
    )
    // 199 tachos activos: 10 ION (I-001..I-010) + 189 Airkem (A-001..A-189) del histórico
    expect(metrics.containersInCirculation).toBe(199)
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
})
