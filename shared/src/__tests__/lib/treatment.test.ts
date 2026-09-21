import {
  treatmentRunId, treatmentLocationId, uuidV5, listTreatmentCandidates,
} from '@hospiwaste/shared/lib/data/treatment'

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

import type {
  Container, ContainerReception, StorageEvent, TreatmentRun, ExternalTransfer,
} from '@hospiwaste/shared/lib/types'

const cont = (id: string): Container => ({
  id, size_liters: 240, tare_weight_kg: 13.5, status: 'active',
  registered_at: '2026-01-01T00:00:00Z',
})

const rec = (
  id: string, container_id: string, arrived_at: string,
  extra: Partial<ContainerReception> = {},
): ContainerReception => ({
  id, container_id, weighing_session_id: null, arrived_at,
  gross_weight_kg: 40, operator_id: 'op-1', photo_ids: [], observations: '',
  waste_type: 'infectious', ...extra,
})

const sto = (id: string, container_id: string, entry_at: string, exit_at: string | null = null): StorageEvent => ({
  id, container_id, entry_at, exit_at, operator_id: 'op-1', photo_ids: [],
})

const emptySlice = {
  containers: [] as Container[],
  receptions: [] as ContainerReception[],
  storageEvents: [] as StorageEvent[],
  treatmentRuns: [] as TreatmentRun[],
  externalTransfers: [] as ExternalTransfer[],
}

const NOW = new Date('2026-09-18T12:00:00Z').getTime()

describe('listTreatmentCandidates', () => {
  it('incluye un tacho infeccioso en cámara fría sin tratamiento posterior', () => {
    const out = listTreatmentCandidates({
      ...emptySlice,
      containers: [cont('001')],
      receptions: [rec('r1', '001', '2026-09-17T08:00:00Z')],
      storageEvents: [sto('s1', '001', '2026-09-17T09:00:00Z')],
    }, NOW)
    expect(out.map((c) => c.container.id)).toEqual(['001'])
  })

  it('un tacho tratado HOY tras una recepción de AYER no reaparece (regresión del bug de julio)', () => {
    const out = listTreatmentCandidates({
      ...emptySlice,
      containers: [cont('001')],
      receptions: [rec('r1', '001', '2026-09-17T08:00:00Z')],
      storageEvents: [sto('s1', '001', '2026-09-17T09:00:00Z')],
      treatmentRuns: [{
        id: 't1', container_id: '001', started_at: '2026-09-18T07:00:00Z',
        completed_at: '2026-09-18T07:00:00Z', operator_id: 'op-1',
      }],
    }, NOW)
    expect(out).toEqual([])
  })

  it('un tacho con recepción POSTERIOR a su último tratamiento sí reaparece', () => {
    const out = listTreatmentCandidates({
      ...emptySlice,
      containers: [cont('001')],
      receptions: [rec('r2', '001', '2026-09-18T08:00:00Z')],
      storageEvents: [sto('s2', '001', '2026-09-18T09:00:00Z')],
      treatmentRuns: [{
        id: 't1', container_id: '001', started_at: '2026-09-17T07:00:00Z',
        completed_at: '2026-09-17T07:00:00Z', operator_id: 'op-1',
      }],
    }, NOW)
    expect(out.map((c) => c.container.id)).toEqual(['001'])
  })

  it('excluye los anatomopatológicos: salen por traslado externo', () => {
    const out = listTreatmentCandidates({
      ...emptySlice,
      containers: [cont('001')],
      receptions: [rec('r1', '001', '2026-09-17T08:00:00Z', { waste_type: 'anatomopathological' })],
      storageEvents: [sto('s1', '001', '2026-09-17T09:00:00Z')],
    }, NOW)
    expect(out).toEqual([])
  })

  it('ignora la recepción anulada y usa la anterior vigente', () => {
    const out = listTreatmentCandidates({
      ...emptySlice,
      containers: [cont('001')],
      receptions: [
        rec('r1', '001', '2026-09-17T08:00:00Z'),
        rec('r2', '001', '2026-09-18T08:00:00Z', { voided_at: '2026-09-18T08:30:00Z' }),
      ],
      storageEvents: [sto('s1', '001', '2026-09-17T09:00:00Z')],
    }, NOW)
    expect(out.map((c) => c.reception.id)).toEqual(['r1'])
  })

  it('excluye el tacho sin cámara fría (pesado pero con la sesión sin cerrar)', () => {
    const out = listTreatmentCandidates({
      ...emptySlice,
      containers: [cont('001')],
      receptions: [rec('r1', '001', '2026-09-17T08:00:00Z')],
    }, NOW)
    expect(out).toEqual([])
  })

  it('excluye los tachos dados de baja', () => {
    const out = listTreatmentCandidates({
      ...emptySlice,
      containers: [{ ...cont('001'), status: 'decommissioned' }],
      receptions: [rec('r1', '001', '2026-09-17T08:00:00Z')],
      storageEvents: [sto('s1', '001', '2026-09-17T09:00:00Z')],
    }, NOW)
    expect(out).toEqual([])
  })

  it('ordena por antigüedad en cámara fría: el más viejo primero', () => {
    const out = listTreatmentCandidates({
      ...emptySlice,
      containers: [cont('001'), cont('002')],
      receptions: [
        rec('r1', '001', '2026-09-18T08:00:00Z'),
        rec('r2', '002', '2026-09-10T08:00:00Z'),
      ],
      storageEvents: [
        sto('s1', '001', '2026-09-18T09:00:00Z'),
        sto('s2', '002', '2026-09-10T09:00:00Z'),
      ],
    }, NOW)
    expect(out.map((c) => c.container.id)).toEqual(['002', '001'])
  })

  it('calcula coldStorageSinceMs desde la entrada a cámara fría', () => {
    const out = listTreatmentCandidates({
      ...emptySlice,
      containers: [cont('001')],
      receptions: [rec('r1', '001', '2026-09-18T08:00:00Z')],
      storageEvents: [sto('s1', '001', '2026-09-18T09:00:00Z')],
    }, NOW)
    expect(out[0].coldStorageSinceMs).toBe(3 * 60 * 60 * 1000)
  })
})
