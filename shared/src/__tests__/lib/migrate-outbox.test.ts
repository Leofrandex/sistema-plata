import 'fake-indexeddb/auto'
import { enqueueOp, putPhotoBlob, listOps, removeOp } from '@hospiwaste/shared/lib/offline-queue'
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

  it('no descarta ops silenciosamente: blob faltante y tipo desconocido quedan en el outbox', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})

    await enqueueOp({ op_id: 're:re2', type: 'create_route_event', payload: { id: 're2', slot: 2 }, deps: [] })
    // upload_photo sin blob correspondiente (nunca se llamó putPhotoBlob para p2)
    await enqueueOp({
      op_id: 'ph:p2-missing', type: 'upload_photo',
      payload: { photo_id: 'p2', event_type: 'route_event', event_id: 're2', label: 'Andén',
                 uploaded_by: 'op1', taken_at: '2026-07-22T10:00:00Z', role: 'dirty', ext: 'jpg' },
      deps: [],
    })
    // tipo de op desconocido
    await enqueueOp({
      op_id: 'unknown:op1', type: 'not_a_real_type' as never,
      payload: { id: 'x1' },
      deps: [],
    })

    const store = createIdbStore('migrate-outbox-drops-test')
    await store.init()
    const result = await migrateOutboxToLocalStore(store)

    expect(result.migrated).toBe(1)
    expect((await store.getRows('route_events')).map((r) => r.payload)).toContainEqual({ id: 're2', slot: 2 })

    const remainingOps = await listOps()
    expect(remainingOps.map((op) => op.op_id).sort()).toEqual(['ph:p2-missing', 'unknown:op1'])

    expect(warnSpy).toHaveBeenCalledWith(
      '[migrate-outbox] blob faltante, se deja la op en el outbox', 'ph:p2-missing', 'missing_blob'
    )
    expect(warnSpy).toHaveBeenCalledWith(
      '[migrate-outbox] tipo de op desconocido, se deja la op en el outbox', 'unknown:op1', 'unknown_type'
    )

    warnSpy.mockRestore()
    await removeOp('ph:p2-missing')
    await removeOp('unknown:op1')
  })
})
