import { computePhaseMetrics } from '@/components/containers/phase-metrics'
import type { ContainerReception, StorageEvent } from '@/lib/types'

describe('computePhaseMetrics', () => {
  it('returns null duration when phase has no end time', () => {
    const reception: ContainerReception = {
      id: 'r-1', container_id: 'I-001', weighing_session_id: null,
      arrived_at: '2026-05-03T09:00:00Z', gross_weight_kg: 43.7,
      operator_id: 'user-1', photo_ids: [],
    }
    const storage: StorageEvent = {
      id: 's-1', container_id: 'I-001',
      entry_at: '2026-05-03T10:00:00Z', exit_at: null,
      operator_id: 'user-1', photo_ids: [],
    }
    const metrics = computePhaseMetrics(reception, storage, null)
    expect(metrics.coldStorageDurationHours).toBeNull()
    expect(metrics.weighingDurationHours).toBeCloseTo(1)
  })

  it('returns duration when storage is complete', () => {
    const reception: ContainerReception = {
      id: 'r-1', container_id: 'I-001', weighing_session_id: null,
      arrived_at: '2026-05-03T09:00:00Z', gross_weight_kg: 43.7,
      operator_id: 'user-1', photo_ids: [],
    }
    const storage: StorageEvent = {
      id: 's-1', container_id: 'I-001',
      entry_at: '2026-05-03T10:00:00Z', exit_at: '2026-05-03T14:00:00Z',
      operator_id: 'user-1', photo_ids: [],
    }
    const metrics = computePhaseMetrics(reception, storage, null)
    expect(metrics.coldStorageDurationHours).toBeCloseTo(4)
  })
})
