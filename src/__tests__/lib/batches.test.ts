import { computeNextPendingStep } from '@/lib/data/batches'
import type { ContainerPhase } from '@/lib/types'

describe('computeNextPendingStep', () => {
  it('returns exchange when all containers are clean', () => {
    const phases: ContainerPhase[] = ['clean', 'clean', 'clean']
    expect(computeNextPendingStep(phases)).toBe('exchange')
  })

  it('returns the earliest incomplete phase', () => {
    const phases: ContainerPhase[] = ['cold_storage', 'weighing', 'exchange']
    expect(computeNextPendingStep(phases)).toBe('exchange')
  })

  it('returns clean when all containers are clean', () => {
    const phases: ContainerPhase[] = ['clean', 'clean']
    // All done — next step is exchange (new cycle)
    expect(computeNextPendingStep(phases)).toBe('exchange')
  })
})
