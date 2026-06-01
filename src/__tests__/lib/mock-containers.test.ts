import { MOCK_CONTAINERS } from '@/lib/mock-data'

describe('MOCK_CONTAINERS — Yaris y metálicos', () => {
  it('incluye 15 tachos metálicos M1..M15 de 120 L sin empresa', () => {
    const metallic = MOCK_CONTAINERS.filter((c) => c.is_metallic_dedicated)
    expect(metallic).toHaveLength(15)
    expect(metallic.every((c) => c.size_liters === 120)).toBe(true)
    expect(metallic.every((c) => !c.company_id)).toBe(true)
    expect(metallic.map((c) => c.id)).toContain('M1')
    expect(metallic.map((c) => c.id)).toContain('M15')
  })

  it('marca 17 tachos Airkem como dedicados a Yaris', () => {
    expect(MOCK_CONTAINERS.filter((c) => c.is_yaris_dedicated)).toHaveLength(17)
  })
})
