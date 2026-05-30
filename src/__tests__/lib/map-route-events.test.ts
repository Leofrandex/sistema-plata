import { mapRouteEvents } from '@/components/supabase-hydrator'
import type { RouteEventRow, RouteContainerLink } from '@/lib/supabase/queries'

function makeRow(over: Partial<RouteEventRow> = {}): RouteEventRow {
  return {
    id: 'evt-1',
    client_id: 'client-1',
    kind: 'anden',
    slot: '06:30',
    date: '2026-05-25',
    started_at: '2026-05-25T06:30:00Z',
    ended_at: '2026-05-25T07:00:00Z',
    operator_id: 'op-1',
    status: 'completed',
    floor: '2',
    area: 'UCI',
    dock: 'A',
    created_at: '2026-05-25T06:30:00Z',
    ...over,
  }
}

describe('mapRouteEvents', () => {
  it('asocia los tachos sucios y limpios a su recorrido', () => {
    const events = [makeRow({ id: 'evt-1' }), makeRow({ id: 'evt-2', slot: '10:30' })]
    const dirty: RouteContainerLink[] = [
      { route_event_id: 'evt-1', container_id: 'A-001' },
      { route_event_id: 'evt-1', container_id: 'A-002' },
      { route_event_id: 'evt-2', container_id: 'A-003' },
    ]
    const clean: RouteContainerLink[] = [
      { route_event_id: 'evt-1', container_id: 'A-009' },
    ]

    const result = mapRouteEvents(events, dirty, clean)

    const e1 = result.find((r) => r.id === 'evt-1')!
    expect(e1.containers_dirty_received).toEqual(['A-001', 'A-002'])
    expect(e1.containers_clean_delivered).toEqual(['A-009'])

    const e2 = result.find((r) => r.id === 'evt-2')!
    expect(e2.containers_dirty_received).toEqual(['A-003'])
    expect(e2.containers_clean_delivered).toEqual([])
  })

  it('devuelve arrays vacíos cuando un recorrido no tiene tachos', () => {
    const result = mapRouteEvents([makeRow({ id: 'evt-x' })], [], [])
    expect(result[0].containers_dirty_received).toEqual([])
    expect(result[0].containers_clean_delivered).toEqual([])
  })

  it('preserva los campos base del recorrido', () => {
    const result = mapRouteEvents([makeRow({ kind: 'morgue', slot: null })], [], [])
    expect(result[0]).toMatchObject({
      kind: 'morgue',
      slot: null,
      floor: '2',
      area: 'UCI',
      dock: 'A',
      status: 'completed',
    })
  })
})
