// src/__tests__/lib/field-writes.test.ts
/**
 * @jest-environment jsdom
 */
// jsdom no polyfills structuredClone (needed by fake-indexeddb); polyfill here.
if (typeof globalThis.structuredClone === 'undefined') {
  globalThis.structuredClone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T
}
import 'fake-indexeddb/auto'
import {
  submitWeighingSession, submitReception, submitRouteEvent,
  routeEventOpId,
} from '@/lib/data/field-writes'
import { listOps, removeOp } from '@hospiwaste/shared/lib/offline-queue'

// jsdom provee window + Event para notifyOutboxChanged; no hace falta stub.
beforeEach(async () => {
  for (const o of await listOps()) await removeOp(o.op_id)
})

it('encola sesión y recepción con dep correcta', async () => {
  await submitWeighingSession({ id: 's1', client_id: 'c1', date: 'd', started_at: 't', operator_id: 'u1' })
  await submitReception({
    id: 'r1', container_id: 'c1', weighing_session_id: 's1', arrived_at: 't',
    gross_weight_kg: 10, operator_id: 'u1', observations: '', company_id: null,
    waste_type: 'infectious', treat_immediately: false,
  })
  const ops = await listOps()
  const ws = ops.find((o) => o.op_id === 'ws:s1')!
  const rec = ops.find((o) => o.op_id === 'rec:r1')!
  expect(ws.type).toBe('create_weighing_session')
  expect((ws.payload as { status: string }).status).toBe('in_progress')
  expect(rec.type).toBe('create_reception')
  expect(rec.deps).toEqual(['ws:s1'])
})

it('encola route_event + containers dirty/clean con deps al evento', async () => {
  await submitRouteEvent(
    { id: 're1', client_id: 'c1', company_id: null, kind: 'anden', slot: '06:30', date: 'd', started_at: 't', operator_id: 'u1', status: 'in_progress', area: 'A' },
    ['t1', 't2'], ['t3'],
  )
  const ops = await listOps()
  expect(ops.find((o) => o.op_id === 'rc:re1:dirty')!.deps).toEqual([routeEventOpId('re1')])
  const dirty = ops.find((o) => o.op_id === 'rc:re1:dirty')!
  expect((dirty.payload as { table: string }).table).toBe('route_event_containers_dirty')
  expect((dirty.payload as { rows: unknown[] }).rows).toHaveLength(2)
})
