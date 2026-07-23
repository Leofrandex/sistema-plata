import 'fake-indexeddb/auto'
import { createIdbStore } from '@hospiwaste/shared/lib/local-store/idb-store'
import type { NewLocalPhoto } from '@hospiwaste/shared/lib/local-store/types'

const photo = (id: string): NewLocalPhoto => ({
  photo_id: id, event_type: 'route_event', event_id: 're1', label: 'Andén',
  uploaded_by: 'op1', taken_at: '2026-07-22T10:00:00Z', role: 'dirty',
  ext: 'jpg', content_type: 'image/jpeg',
})

describe('idb-store', () => {
  let testCounter = 0

  it('putRow deja la fila con synced=0 y getRows la devuelve', async () => {
    const s = createIdbStore(`test-db-${testCounter++}`)
    await s.init()
    await s.putRow('route_events', 're1', { id: 're1', slot: 1 })
    const rows = await s.getRows('route_events')
    expect(rows).toHaveLength(1)
    expect(rows[0].payload).toEqual({ id: 're1', slot: 1 })
    expect(rows[0].synced).toBe(false)
  })

  it('markRowSynced saca la fila de getUnsyncedRows pero no de getRows', async () => {
    const s = createIdbStore(`test-db-${testCounter++}`)
    await s.init()
    await s.putRow('weighing_sessions', 'ws1', { id: 'ws1' })
    await s.markRowSynced('weighing_sessions', 'ws1')
    expect(await s.isRowSynced('weighing_sessions', 'ws1')).toBe(true)
    expect(await s.getUnsyncedRows()).toHaveLength(0)
    expect(await s.getRows('weighing_sessions')).toHaveLength(1)
  })

  it('putRow sobre una fila existente la re-marca como pendiente y limpia el error', async () => {
    const s = createIdbStore(`test-db-${testCounter++}`)
    await s.init()
    await s.putRow('route_events', 're2', { v: 1 })
    await s.markRowFailed('route_events', 're2', 'rechazo 400')
    await s.putRow('route_events', 're2', { v: 2 })
    const [r] = await s.getRows('route_events')
    expect(r.payload).toEqual({ v: 2 })
    expect(r.synced).toBe(false)
    expect(r.sync_error).toBeNull()
    expect(r.attempts).toBe(0)
  })

  it('fotos: put/get blob, markPhotoSynced borra el binario', async () => {
    const s = createIdbStore(`test-db-${testCounter++}`)
    await s.init()
    await s.putPhoto(photo('p1'), new Blob(['x'], { type: 'image/jpeg' }))
    expect(await s.getPhotoBlob('p1')).not.toBeNull()
    expect(await s.getUnsyncedPhotos()).toHaveLength(1)
    await s.markPhotoSynced('p1')
    expect(await s.getUnsyncedPhotos()).toHaveLength(0)
    expect(await s.getPhotoBlob('p1')).toBeNull()
  })

  it('pendingCounts separa records, photos y rejected', async () => {
    const s = createIdbStore(`test-db-${testCounter++}`)
    await s.init()
    await s.putRow('route_events', 're3', {})
    await s.putRow('route_events', 're4', {})
    await s.markRowFailed('route_events', 're4', 'boom')
    await s.putPhoto(photo('p2'), new Blob(['y']))
    expect(await s.pendingCounts()).toEqual({ records: 2, photos: 1, rejected: 1 })
  })

  it('meta get/set', async () => {
    const s = createIdbStore(`test-db-${testCounter++}`)
    await s.init()
    expect(await s.getMeta('migrated_outbox')).toBeNull()
    await s.setMeta('migrated_outbox', '1')
    expect(await s.getMeta('migrated_outbox')).toBe('1')
  })
})
