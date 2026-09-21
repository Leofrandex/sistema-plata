/**
 * @jest-environment jsdom
 */
import 'fake-indexeddb/auto'
import { getLocalStore } from '@hospiwaste/shared/lib/local-store'
import { treatContainers } from '@/lib/data/treat-containers'
import type { TreatmentCandidate } from '@hospiwaste/shared/lib/data/treatment'

const NOW = '2026-09-18T15:00:00Z'

function candidate(id: string, exitAt: string | null = null): TreatmentCandidate {
  return {
    container: {
      id, size_liters: 240, tare_weight_kg: 13.5, status: 'active',
      registered_at: '2026-01-01T00:00:00Z',
    },
    reception: {
      id: `rec-${id}`, container_id: id, weighing_session_id: null,
      arrived_at: '2026-09-18T08:00:00Z', gross_weight_kg: 40, operator_id: 'op-1',
      photo_ids: [], observations: '', waste_type: 'infectious',
    },
    storageEvent: {
      id: `sto-${id}`, container_id: id, entry_at: '2026-09-18T09:00:00Z',
      exit_at: exitAt, operator_id: 'op-1', photo_ids: [],
    },
    coldStorageSinceMs: 6 * 60 * 60 * 1000,
  }
}

function sink() {
  return {
    addTreatmentRun: jest.fn(),
    updateStorageEvent: jest.fn(),
    addLocation: jest.fn(),
  }
}

describe('treatContainers', () => {
  it('escribe las tres filas por tacho', async () => {
    const s = sink()
    const res = await treatContainers([candidate('001')], 'op-1', NOW, s)
    expect(res).toEqual({ treated: 1, failedAt: null, error: null })

    const store = await getLocalStore()
    expect((await store.getRows('treatment_runs')).length).toBe(1)
    expect((await store.getRows('container_locations')).length).toBe(1)
    const sto = (await store.getRows('storage_events')).find((r) => r.id === 'sto-001')!
    expect((sto.payload as { exit_at: string }).exit_at).toBe(NOW)
  })

  it('el payload de storage_events no lleva photo_ids', async () => {
    await treatContainers([candidate('002')], 'op-1', NOW, sink())
    const store = await getLocalStore()
    const sto = (await store.getRows('storage_events')).find((r) => r.id === 'sto-002')!
    expect(sto.payload).not.toHaveProperty('photo_ids')
  })

  it('no pisa un exit_at que ya tenía valor', async () => {
    const s = sink()
    await treatContainers([candidate('003', '2026-09-18T10:00:00Z')], 'op-1', NOW, s)
    expect(s.updateStorageEvent).not.toHaveBeenCalled()
    const store = await getLocalStore()
    expect((await store.getRows('storage_events')).find((r) => r.id === 'sto-003')).toBeUndefined()
  })

  it('el mismo tacho y la misma recepción dos veces producen un solo id', async () => {
    await treatContainers([candidate('004')], 'op-1', NOW, sink())
    await treatContainers([candidate('004')], 'op-1', NOW, sink())
    const store = await getLocalStore()
    const runs = (await store.getRows('treatment_runs'))
      .filter((r) => (r.payload as { container_id: string }).container_id === '004')
    expect(runs.length).toBe(1)
  })

  it('actualiza el store por cada tacho tratado', async () => {
    const s = sink()
    await treatContainers([candidate('005')], 'op-1', NOW, s)
    expect(s.addTreatmentRun).toHaveBeenCalledTimes(1)
    expect(s.updateStorageEvent).toHaveBeenCalledWith('sto-005', { exit_at: NOW })
    expect(s.addLocation).toHaveBeenCalledTimes(1)
  })

  it('si falla un tacho corta y reporta cuántos entraron de verdad', async () => {
    const s = sink()
    s.addTreatmentRun
      .mockImplementationOnce(() => {})
      .mockImplementationOnce(() => { throw new Error('boom') })
    const res = await treatContainers([candidate('006'), candidate('007')], 'op-1', NOW, s)
    expect(res.treated).toBe(1)
    expect(res.failedAt).toBe('007')
    expect(res.error).toBeInstanceOf(Error)
  })
})
