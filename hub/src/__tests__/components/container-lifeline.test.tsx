import { getPhaseIndex, PHASES } from '@/components/containers/container-lifeline'

describe('getPhaseIndex', () => {
  it('returns 0 for route', () => {
    expect(getPhaseIndex('route')).toBe(0)
  })

  it('returns the correct index for cold_storage', () => {
    expect(getPhaseIndex('cold_storage')).toBe(2)
  })

  it('returns last index for clean', () => {
    expect(getPhaseIndex('clean')).toBe(PHASES.length - 1)
  })
})
