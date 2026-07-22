import { filterContainers } from '@/components/register/container-selector'
import type { Container } from '@hospiwaste/shared/lib/types'

const containers: Container[] = [
  { id: 'I-001', company_id: 'company-ion', size_liters: 240, tare_weight_kg: 14.2, status: 'active', registered_at: '2026-01-01T00:00:00Z' },
  { id: 'I-002', company_id: 'company-ion', size_liters: 240, tare_weight_kg: 14.5, status: 'active', registered_at: '2026-01-01T00:00:00Z' },
  { id: 'A-001', company_id: 'company-airkem', size_liters: 240, tare_weight_kg: 14.1, status: 'active', registered_at: '2026-01-01T00:00:00Z' },
  { id: 'I-999', company_id: 'company-ion', size_liters: 240, tare_weight_kg: 14.0, status: 'decommissioned', registered_at: '2026-01-01T00:00:00Z' },
]

describe('filterContainers', () => {
  it('returns only active containers matching search', () => {
    const result = filterContainers(containers, 'I-0')
    expect(result).toHaveLength(2)
    expect(result.map((c) => c.id)).toEqual(['I-001', 'I-002'])
  })

  it('excludes decommissioned containers', () => {
    const result = filterContainers(containers, 'I-999')
    expect(result).toHaveLength(0)
  })

  it('returns empty array when no match', () => {
    const result = filterContainers(containers, 'Z-999')
    expect(result).toHaveLength(0)
  })

  it('returns all active containers when search is empty', () => {
    const result = filterContainers(containers, '')
    expect(result).toHaveLength(3)
  })
})
