import 'fake-indexeddb/auto'
import { enqueueOp, putPhotoBlob, listOps } from '@hospiwaste/shared/lib/offline-queue'
import { createIdbStore } from '@hospiwaste/shared/lib/local-store/idb-store'
import { migrateOutboxToLocalStore } from '@hospiwaste/shared/lib/local-store/migrate-outbox'

describe('migrateOutboxToLocalStore', () => {
  it('convierte ops de tabla, join tables y fotos; limpia el outbox; es idempotente', async () => {
    await enqueueOp({ op_id: 're:re1', type: 'create_route_event', payload: { id: 're1', slot: 1 }, deps: [] })
    await enqueueOp({
      op_id: 'rc:re1:dirty', type: 'add_route_containers',
      payload: { table: 'route_event_containers_dirty', rows: [{ route_event_id: 're1', container_id: 'c1' }] },
      deps: ['re:re1'],
    })
    await putPhotoBlob({ photo_id: 'p1', blob: new Blob(['x']), content_type: 'image/jpeg' })
    await enqueueOp({
      op_id: 'ph:p1', type: 'upload_photo',
      payload: { photo_id: 'p1', event_type: 'route_event', event_id: 're1', label: 'Andén',
                 uploaded_by: 'op1', taken_at: '2026-07-22T10:00:00Z', role: 'dirty', ext: 'jpg' },
      deps: ['re:re1'],
    })

    const store = createIdbStore()
    await store.init()
    const r1 = await migrateOutboxToLocalStore(store)
    expect(r1.migrated).toBe(3)

    expect((await store.getRows('route_events'))[0].payload).toEqual({ id: 're1', slot: 1 })
    const join = await store.getRows('route_event_containers_dirty')
    expect(join[0].id).toBe('re1:c1')
    expect(join[0].payload).toEqual({ route_event_id: 're1', container_id: 'c1' })
    expect(await store.getUnsyncedPhotos()).toHaveLength(1)
    expect(await store.getPhotoBlob('p1')).not.toBeNull()
    expect(await listOps()).toHaveLength(0)

    const r2 = await migrateOutboxToLocalStore(store) // idempotente
    expect(r2.migrated).toBe(0)
  })
})
