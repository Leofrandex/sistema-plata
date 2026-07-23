// src/__tests__/lib/field-writes.test.ts
/**
 * @jest-environment jsdom
 */
import 'fake-indexeddb/auto'
import { getLocalStore } from '@hospiwaste/shared/lib/local-store'
import { submitRouteEvent, submitWeighingSession, submitReception } from '@/lib/data/field-writes'

describe('field-writes → LocalStore', () => {
  it('submitRouteEvent inserta el evento y sus join rows con synced=0', async () => {
    await submitRouteEvent({ id: 're1', date: '2026-07-22', slot: 1, operator_id: 'op1' } as never, ['c1'], ['c2'])
    const s = await getLocalStore()
    expect((await s.getRows('route_events')).map((r) => r.id)).toContain('re1')
    expect((await s.getRows('route_event_containers_dirty'))[0].payload)
      .toEqual({ route_event_id: 're1', container_id: 'c1' })
    expect((await s.getRows('route_event_containers_clean'))[0].payload)
      .toEqual({ route_event_id: 're1', container_id: 'c2' })
  })

  it('submitReception referencia a su sesión por payload (el orden lo da SYNC_ORDER)', async () => {
    await submitWeighingSession({ id: 'ws1', client_id: 'cl', date: '2026-07-22',
      started_at: 't', operator_id: 'op1' })
    await submitReception({ id: 'rec1', weighing_session_id: 'ws1' } as never)
    const s = await getLocalStore()
    expect((await s.getRows('container_receptions'))[0].payload)
      .toMatchObject({ weighing_session_id: 'ws1' })
  })
})
