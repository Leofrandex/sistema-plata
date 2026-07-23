import 'fake-indexeddb/auto'
import { createIdbStore } from '@hospiwaste/shared/lib/local-store/idb-store'
import { hydrateFromLocal, localPendingIds } from '@hospiwaste/shared/lib/local-store/hydrate-local'

it('agrupa filas locales por entidad y expone joins por evento', async () => {
  const s = createIdbStore()
  await s.init()
  await s.putRow('route_events', 'reH', { id: 'reH', slot: 2 })
  await s.putRow('route_event_containers_dirty', 'reH:c1', { route_event_id: 'reH', container_id: 'c1' })
  await s.putRow('weighing_sessions', 'wsH', { id: 'wsH' })
  await s.markRowSynced('weighing_sessions', 'wsH')

  const snap = await hydrateFromLocal(s)
  expect(snap.routeEvents).toEqual([{ id: 'reH', slot: 2 }])
  expect(snap.dirtyByEvent.get('reH')).toEqual(['c1'])
  expect(snap.weighingSessions).toEqual([{ id: 'wsH' }]) // synced también se hidrata: es el estado del día

  const pending = await localPendingIds(s)
  expect(pending.has('reH')).toBe(true)
  expect(pending.has('wsH')).toBe(false) // ya sincronizada: el server la trae
})
