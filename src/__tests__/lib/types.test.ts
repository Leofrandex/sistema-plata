import type { Container, ContainerReception, Company } from '@/lib/types'

describe('types', () => {
  it('Container id follows company-letter-number format', () => {
    const c: Container = {
      id: 'I-001',
      company_id: 'company-ion',
      size_liters: 240,
      tare_weight_kg: 15.5,
      waste_type: 'infectious',
      status: 'active',
      registered_at: '2026-01-01T00:00:00Z',
    }
    expect(c.id).toMatch(/^[A-Z]-\d+$/)
  })

  it('Company belongs to a client and has a code letter', () => {
    const co: Company = {
      id: 'company-ion',
      client_id: 'client-1',
      name: 'ION',
      code_letter: 'I',
    }
    expect(co.code_letter).toHaveLength(1)
    expect(co.client_id).toBeTruthy()
  })

  it('ContainerReception net weight is computable', () => {
    const r: ContainerReception = {
      id: 'r-1', container_id: 'I-001', weighing_session_id: null,
      arrived_at: '2026-05-03T09:00:00Z', gross_weight_kg: 45.2,
      operator_id: 'user-1', photo_ids: [],
    }
    const tare = 15.5
    const net = r.gross_weight_kg - tare
    expect(net).toBeCloseTo(29.7)
  })
})
