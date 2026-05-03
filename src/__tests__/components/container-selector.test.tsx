import { filterContainers } from '@/components/register/container-selector'
import type { Container } from '@/lib/types'

const containers: Container[] = [
  { id: 'A-001', client_id: 'client-1', size_liters: 240, tare_weight_kg: 14.2, waste_type: 'infectious', status: 'active', registered_at: '2026-01-01T00:00:00Z' },
  { id: 'A-002', client_id: 'client-1', size_liters: 240, tare_weight_kg: 14.5, waste_type: 'infectious', status: 'active', registered_at: '2026-01-01T00:00:00Z' },
  { id: 'B-001', client_id: 'client-2', size_liters: 240, tare_weight_kg: 14.1, waste_type: 'infectious', status: 'active', registered_at: '2026-01-01T00:00:00Z' },
  { id: 'A-999', client_id: 'client-1', size_liters: 240, tare_weight_kg: 14.0, waste_type: 'infectious', status: 'decommissioned', registered_at: '2026-01-01T00:00:00Z' },
]

describe('filterContainers', () => {
  it('returns only active containers matching search', () => {
    const result = filterContainers(containers, 'A-0')
    expect(result).toHaveLength(2)
    expect(result.map((c) => c.id)).toEqual(['A-001', 'A-002'])
  })

  it('excludes decommissioned containers', () => {
    const result = filterContainers(containers, 'A-999')
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
