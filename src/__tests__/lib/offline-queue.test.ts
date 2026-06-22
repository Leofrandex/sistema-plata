/**
 * @jest-environment node
 */
import { enqueue, dequeueAll, clearAll } from '@/lib/offline-queue'
import {
  enqueueOp, listOps, removeOp, bumpAttempts, countPendingOps,
  putPhotoBlob, getPhotoBlob, removePhotoBlob,
} from '@/lib/offline-queue'
import 'fake-indexeddb/auto'

describe('offline-queue', () => {
  beforeEach(async () => {
    await clearAll()
  })

  it('enqueues and dequeues items', async () => {
    await enqueue({ type: 'weighing', payload: { container_id: 'A-001', gross_weight_kg: 43.7 } })
    await enqueue({ type: 'storage', payload: { container_id: 'A-001' } })

    const items = await dequeueAll()
    expect(items).toHaveLength(2)
    expect(items[0].type).toBe('weighing')
    expect(items[1].type).toBe('storage')
  })

  it('clearAll removes all items', async () => {
    await enqueue({ type: 'weighing', payload: { container_id: 'A-001', gross_weight_kg: 43.7 } })
    await clearAll()
    const items = await dequeueAll()
    expect(items).toHaveLength(0)
  })
})

describe('outbox ops', () => {
  beforeEach(async () => {
    const ops = await listOps()
    await Promise.all(ops.map((o) => removeOp(o.op_id)))
  })

  it('encola, lista en orden FIFO y cuenta', async () => {
    await enqueueOp({ op_id: 'a', type: 'create_weighing_session', payload: { id: 's1' }, deps: [] })
    await enqueueOp({ op_id: 'b', type: 'create_reception', payload: { id: 'r1' }, deps: ['a'] })
    const ops = await listOps()
    expect(ops.map((o) => o.op_id)).toEqual(['a', 'b'])
    expect(ops[0].attempts).toBe(0)
    expect(ops[0].created_at).toBeTruthy()
    expect(await countPendingOps()).toBe(2)
  })

  it('removeOp y bumpAttempts', async () => {
    await enqueueOp({ op_id: 'a', type: 'create_weighing_session', payload: {}, deps: [] })
    await bumpAttempts('a')
    await bumpAttempts('a')
    const [op] = await listOps()
    expect(op.attempts).toBe(2)
    await removeOp('a')
    expect(await countPendingOps()).toBe(0)
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
