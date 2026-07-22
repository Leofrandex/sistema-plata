/**
 * @jest-environment node
 */
import 'fake-indexeddb/auto'
import { drainOutbox } from '@hospiwaste/shared/lib/outbox-sync'
import { enqueueOp, listOps, removeOp } from '@hospiwaste/shared/lib/offline-queue'

async function clearOutbox() {
  for (const o of await listOps()) await removeOp(o.op_id)
}

// db que falla de forma controlada según la tabla/registro.
function makeDb(opts: { failTable?: string; network?: boolean } = {}) {
  const applied: string[] = []
  const db = {
    from(table: string) {
      return {
        upsert(payload: { id?: string }) {
          if (opts.failTable === table) {
            return opts.network
              ? Promise.reject(new TypeError('Failed to fetch'))
              : Promise.resolve({ error: { message: 'duplicate key' } })
          }
          applied.push(`${table}:${(payload as { id?: string }).id ?? '?'}`)
          return Promise.resolve({ error: null })
        },
      }
    },
    storage: { from: () => ({ upload: () => Promise.resolve({ error: null }) }) },
  }
  return { db: db as unknown as Parameters<typeof drainOutbox>[0], applied }
}

beforeEach(clearOutbox)

it('drena en orden de dependencias y limpia la cola', async () => {
  await enqueueOp({ op_id: 'sess', type: 'create_weighing_session', payload: { id: 's1' }, deps: [] })
  await enqueueOp({ op_id: 'rec', type: 'create_reception', payload: { id: 'r1' }, deps: ['sess'] })
  const { db, applied } = makeDb()
  const res = await drainOutbox(db)
  expect(res.synced).toBe(2)
  expect(applied).toEqual(['weighing_sessions:s1', 'container_receptions:r1'])
  expect(await listOps()).toHaveLength(0)
})

it('una op no-red atascada no bloquea a las independientes', async () => {
  await enqueueOp({ op_id: 'bad', type: 'create_weighing_session', payload: { id: 'bad' }, deps: [] })
  await enqueueOp({ op_id: 'good', type: 'create_storage_event', payload: { id: 'g1' }, deps: [] })
  const { db, applied } = makeDb({ failTable: 'weighing_sessions' })
  const res = await drainOutbox(db)
  expect(applied).toEqual(['storage_events:g1'])
  expect(res.synced).toBe(1)
  const remaining = await listOps()
  expect(remaining.map((o) => o.op_id)).toEqual(['bad'])
  expect(remaining[0].attempts).toBe(1) // intento contado
})

it('un dependiente de una op atascada no se aplica', async () => {
  await enqueueOp({ op_id: 'sess', type: 'create_weighing_session', payload: { id: 'bad' }, deps: [] })
  await enqueueOp({ op_id: 'rec', type: 'create_reception', payload: { id: 'r1' }, deps: ['sess'] })
  const { db, applied } = makeDb({ failTable: 'weighing_sessions' })
  await drainOutbox(db)
  expect(applied).toEqual([]) // rec espera a sess
  expect((await listOps()).map((o) => o.op_id).sort()).toEqual(['rec', 'sess'])
})

it('error de red detiene el ciclo sin contar intento', async () => {
  await enqueueOp({ op_id: 'a', type: 'create_storage_event', payload: { id: 'a' }, deps: [] })
  const { db } = makeDb({ failTable: 'storage_events', network: true })
  const res = await drainOutbox(db)
  expect(res.synced).toBe(0)
  const [op] = await listOps()
  expect(op.attempts).toBe(0)
})
