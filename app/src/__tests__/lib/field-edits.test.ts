// src/__tests__/lib/field-edits.test.ts
/**
 * @jest-environment jsdom
 */
import 'fake-indexeddb/auto'
import { getLocalStore } from '@hospiwaste/shared/lib/local-store'
import { applyFieldEdit } from '@/lib/data/field-edits'

it('registro no sincronizado: reescribe local sin llamar online', async () => {
  const s = await getLocalStore()
  await s.putRow('route_events', 'reE1', { id: 'reE1', v: 1 })
  const online = jest.fn()
  const mode = await applyFieldEdit('route_events', 'reE1', { id: 'reE1', v: 2 }, online)
  expect(mode).toBe('local')
  expect(online).not.toHaveBeenCalled()
  expect((await s.getRows('route_events')).find((r) => r.id === 'reE1')?.payload).toEqual({ id: 'reE1', v: 2 })
})

it('registro sincronizado: va online y propaga el error', async () => {
  const s = await getLocalStore()
  await s.putRow('route_events', 'reE2', { id: 'reE2' })
  await s.markRowSynced('route_events', 'reE2')
  await expect(
    applyFieldEdit('route_events', 'reE2', { id: 'reE2' }, async () => { throw new Error('sin red') }),
  ).rejects.toThrow('sin red')
})
