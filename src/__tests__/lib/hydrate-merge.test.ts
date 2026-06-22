/**
 * @jest-environment node
 */
import 'fake-indexeddb/auto'
import { mergeById, pendingRecordIds } from '@/lib/data/hydrate-merge'
import { enqueueOp, listOps, removeOp } from '@/lib/offline-queue'

beforeEach(async () => { for (const o of await listOps()) await removeOp(o.op_id) })

it('mergeById conserva el local pendiente que aún no está en el server', () => {
  const server = [{ id: 'a', v: 1 }]
  const local = [{ id: 'a', v: 9 }, { id: 'b', v: 2 }]
  const merged = mergeById(server, local, new Set(['b']))
  expect(merged.map((r) => r.id).sort()).toEqual(['a', 'b'])
  // 'a' ya está en server → no se duplica ni se pisa con el local
  expect(merged.find((r) => r.id === 'a')!.v).toBe(1)
})

it('pendingRecordIds quita los prefijos de op_id', async () => {
  await enqueueOp({ op_id: 'rec:r1', type: 'create_reception', payload: {}, deps: [] })
  await enqueueOp({ op_id: 're:e1', type: 'create_route_event', payload: {}, deps: [] })
  await enqueueOp({ op_id: 'photo:p1', type: 'upload_photo', payload: {}, deps: [] })
  const ids = await pendingRecordIds()
  expect(ids.has('r1')).toBe(true)
  expect(ids.has('e1')).toBe(true)
  expect(ids.has('p1')).toBe(false) // las fotos no son "registros" del store
})
