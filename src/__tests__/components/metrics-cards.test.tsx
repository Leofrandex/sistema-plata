import { computeDashboardMetrics } from '@/components/dashboard/metrics-cards'
import { MOCK_CONTAINERS, MOCK_BATCHES, MOCK_STORAGE_EVENTS, MOCK_TREATMENT_RUNS } from '@/lib/mock-data'

describe('computeDashboardMetrics', () => {
  it('counts active batches', () => {
    const metrics = computeDashboardMetrics(MOCK_BATCHES, MOCK_CONTAINERS, MOCK_STORAGE_EVENTS, MOCK_TREATMENT_RUNS)
    expect(metrics.activeBatches).toBe(2) // batch-1 and batch-2
  })

  it('counts containers in active batches', () => {
    const metrics = computeDashboardMetrics(MOCK_BATCHES, MOCK_CONTAINERS, MOCK_STORAGE_EVENTS, MOCK_TREATMENT_RUNS)
    // batch-1 has 5 containers, batch-2 has 2 containers
    expect(metrics.containersInCirculation).toBe(7)
  })

  it('counts containers in cold storage', () => {
    const metrics = computeDashboardMetrics(MOCK_BATCHES, MOCK_CONTAINERS, MOCK_STORAGE_EVENTS, MOCK_TREATMENT_RUNS)
    // storage-1 has no exit_at, so 1 container in cold storage
    expect(metrics.containersInStorage).toBe(1)
  })
})
