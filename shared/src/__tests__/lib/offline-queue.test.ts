/**
 * @jest-environment node
 */
import {
  enqueueOp, listOps, removeOp,
  putPhotoBlob, getPhotoBlob, removePhotoBlob,
} from '@hospiwaste/shared/lib/offline-queue'
import 'fake-indexeddb/auto'

describe('outbox ops (legacy, solo lo que consume la migración a LocalStore)', () => {
  beforeEach(async () => {
    const ops = await listOps()
    await Promise.all(ops.map((o) => removeOp(o.op_id)))
  })

  it('encola y lista en orden FIFO', async () => {
    await enqueueOp({ op_id: 'a', type: 'create_weighing_session', payload: { id: 's1' }, deps: [] })
    await enqueueOp({ op_id: 'b', type: 'create_reception', payload: { id: 'r1' }, deps: ['a'] })
    const ops = await listOps()
    expect(ops.map((o) => o.op_id)).toEqual(['a', 'b'])
    expect(ops[0].attempts).toBe(0)
    expect(ops[0].created_at).toBeTruthy()
  })

  it('removeOp borra la op', async () => {
    await enqueueOp({ op_id: 'a', type: 'create_weighing_session', payload: {}, deps: [] })
    await removeOp('a')
    expect(await listOps()).toHaveLength(0)
  })

  it('guarda y recupera blobs de foto', async () => {
    const blob = new Blob(['x'], { type: 'image/jpeg' })
    await putPhotoBlob({ photo_id: 'p1', blob, content_type: 'image/jpeg' })
    const got = await getPhotoBlob('p1')
    expect(got?.content_type).toBe('image/jpeg')
    await removePhotoBlob('p1')
    expect(await getPhotoBlob('p1')).toBeUndefined()
  })
})
