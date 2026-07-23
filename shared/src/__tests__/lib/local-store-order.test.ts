import { SYNC_ORDER, sortBySyncOrder, PARENT_OF } from '@hospiwaste/shared/lib/local-store/types'
import type { LocalRow } from '@hospiwaste/shared/lib/local-store/types'

function row(tbl: LocalRow['tbl'], id: string, created_at: string): LocalRow {
  return { tbl, id, payload: {}, synced: false, attempts: 0, sync_error: null, created_at }
}

describe('SYNC_ORDER', () => {
  it('ordena padres antes que hijos y respeta created_at dentro de la misma tabla', () => {
    const rows = [
      row('container_receptions', 'r1', '2026-07-22T10:00:00Z'),
      row('route_event_containers_dirty', 're1:c1', '2026-07-22T09:00:00Z'),
      row('weighing_sessions', 'ws1', '2026-07-22T10:05:00Z'),
      row('route_events', 're1', '2026-07-22T09:00:00Z'),
      row('route_events', 're0', '2026-07-22T08:00:00Z'),
    ]
    const sorted = sortBySyncOrder(rows)
    expect(sorted.map((r) => r.id)).toEqual(['re0', 're1', 're1:c1', 'ws1', 'r1'])
  })

  it('PARENT_OF apunta cada hija a su tabla padre', () => {
    expect(PARENT_OF['route_event_containers_dirty']).toBe('route_events')
    expect(PARENT_OF['route_event_containers_clean']).toBe('route_events')
    expect(PARENT_OF['container_receptions']).toBe('weighing_sessions')
    expect(PARENT_OF['route_events']).toBeUndefined()
  })

  it('SYNC_ORDER cubre todas las tablas de dominio', () => {
    expect(SYNC_ORDER).toEqual([
      'route_events',
      'route_event_containers_dirty',
      'route_event_containers_clean',
      'weighing_sessions',
      'container_receptions',
      'treatment_runs',
      'container_locations',
      'storage_events',
    ])
  })
})
