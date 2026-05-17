import { computeDashboardMetrics } from '@/components/dashboard/metrics-cards'
import {
  MOCK_CONTAINERS,
  MOCK_ROUTE_EVENTS,
  MOCK_STORAGE_EVENTS,
  MOCK_TREATMENT_RUNS,
} from '@/lib/mock-data'

describe('computeDashboardMetrics', () => {
  it('counts active containers in circulation', () => {
    const metrics = computeDashboardMetrics(
      MOCK_CONTAINERS,
      MOCK_ROUTE_EVENTS,
      MOCK_STORAGE_EVENTS,
      MOCK_TREATMENT_RUNS
    )
    // 20 envases activos (I-001..I-010, A-001..A-010)
    expect(metrics.containersInCirculation).toBe(20)
  })

  it('counts containers in cold storage', () => {
    const metrics = computeDashboardMetrics(
      MOCK_CONTAINERS,
      MOCK_ROUTE_EVENTS,
      MOCK_STORAGE_EVENTS,
      MOCK_TREATMENT_RUNS
    )
    // storage-1 y storage-2 sin exit_at → 2 envases
    expect(metrics.containersInStorage).toBe(2)
  })

  it('counts routes for a given date', () => {
    const metrics = computeDashboardMetrics(
      MOCK_CONTAINERS,
      MOCK_ROUTE_EVENTS,
      MOCK_STORAGE_EVENTS,
      MOCK_TREATMENT_RUNS,
      '2026-05-17'
    )
    // 2 recorridos mockeados para 2026-05-17
    expect(metrics.routesToday).toBe(2)
  })
})
