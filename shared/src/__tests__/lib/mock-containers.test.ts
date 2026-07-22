import { MOCK_CONTAINERS } from '@hospiwaste/shared/lib/mock-data'

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

  it('incluye 26 contenedores Yaris Y1..Y26 de 1100 L, sin empresa, sin tara', () => {
    const yaris = MOCK_CONTAINERS.filter((c) => c.is_yaris_container)
    expect(yaris).toHaveLength(26)
    expect(yaris.every((c) => c.size_liters === 1100)).toBe(true)
    expect(yaris.every((c) => !c.company_id)).toBe(true)
    expect(yaris.every((c) => c.tare_weight_kg === 0)).toBe(true)
    // Verifica el set exacto Y1..Y26 (no solo los extremos).
    const ids = new Set(yaris.map((c) => c.id))
    for (let i = 1; i <= 26; i++) expect(ids.has(`Y${i}`)).toBe(true)
  })
})
