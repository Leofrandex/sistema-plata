import { treatmentRunId, treatmentLocationId, uuidV5 } from '@hospiwaste/shared/lib/data/treatment'

describe('uuidV5', () => {
  it('reproduce el vector conocido de la RFC 4122 (namespace DNS + www.example.com)', async () => {
    const id = await uuidV5('6ba7b810-9dad-11d1-80b4-00c04fd430c8', 'www.example.com')
    expect(id).toBe('2ed6657d-e927-568b-95e1-2665a8aea6a2')
  })
})

describe('treatmentRunId', () => {
  it('es determinista: mismo tacho y misma recepción dan el mismo id', async () => {
    const a = await treatmentRunId('001', 'rec-1')
    const b = await treatmentRunId('001', 'rec-1')
    expect(a).toBe(b)
  })

  it('cambia cuando cambia la recepción (el ciclo siguiente no colisiona)', async () => {
    const a = await treatmentRunId('001', 'rec-1')
    const b = await treatmentRunId('001', 'rec-2')
    expect(a).not.toBe(b)
  })

  it('cambia cuando cambia el tacho', async () => {
    const a = await treatmentRunId('001', 'rec-1')
    const b = await treatmentRunId('002', 'rec-1')
    expect(a).not.toBe(b)
  })

  it('devuelve un UUID v5 válido (versión 5, variante RFC 4122)', async () => {
    const id = await treatmentRunId('001', 'rec-1')
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  })

  it('el id de la ubicación no colisiona con el del tratamiento', async () => {
    const run = await treatmentRunId('001', 'rec-1')
    const loc = await treatmentLocationId('001', 'rec-1')
    expect(run).not.toBe(loc)
  })
})
