import type {
  WasteType,
  ContainerSize,
  ContainerPhase,
  Container,
  Batch,
  ContainerReception,
} from '@/lib/types'

describe('types', () => {
  it('Container id follows client-letter-number format', () => {
    const c: Container = {
      id: 'A-069',
      client_id: 'client-1',
      size_liters: 240,
      tare_weight_kg: 15.5,
      waste_type: 'infectious',
      status: 'active',
      registered_at: '2026-01-01T00:00:00Z',
    }
    expect(c.id).toMatch(/^[A-Z]-\d+$/)
  })

  it('ContainerReception net weight is computable', () => {
    const tare = 15.5
    const gross = 45.2
    const net = gross - tare
    expect(net).toBeCloseTo(29.7)
  })
})
