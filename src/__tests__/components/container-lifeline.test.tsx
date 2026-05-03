import { getPhaseIndex, PHASES } from '@/components/containers/container-lifeline'
import type { ContainerPhase } from '@/lib/types'

describe('getPhaseIndex', () => {
  it('returns 0 for exchange', () => {
    expect(getPhaseIndex('exchange')).toBe(0)
  })

  it('returns the correct index for cold_storage', () => {
    expect(getPhaseIndex('cold_storage')).toBe(2)
  })

  it('returns last index for clean', () => {
    expect(getPhaseIndex('clean')).toBe(PHASES.length - 1)
  })
})
