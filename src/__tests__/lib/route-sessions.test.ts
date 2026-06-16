import { getSlotAndenEvents, mergePhotoIds } from '@/lib/data/route-sessions'
import type { RouteEvent } from '@/lib/types'

function ev(partial: Partial<RouteEvent>): RouteEvent {
  return {
    id: 'r1',
    client_id: 'c1',
    kind: 'anden',
    slot: '06:30',
    date: '2026-05-27',
    started_at: '2026-05-27T06:30:00.000Z',
    ended_at: null,
    operator_id: 'op1',
    status: 'in_progress',
    containers_dirty_received: [],
    containers_clean_delivered: [],
    area: '',
    photo_ids: [],
    ...partial,
  }
}

describe('getSlotAndenEvents', () => {
  it('devuelve los route_events de andén del horario/día ordenados por started_at', () => {
    const events = [
      ev({ id: 'a', started_at: '2026-05-27T06:40:00.000Z' }),
      ev({ id: 'b', started_at: '2026-05-27T06:31:00.000Z' }),
      ev({ id: 'morgue', kind: 'morgue', slot: null }),
      ev({ id: 'otroDia', date: '2026-05-26' }),
      ev({ id: 'otroSlot', slot: '10:30' }),
    ]
    const result = getSlotAndenEvents(events, '2026-05-27', '06:30')
    expect(result.map((e) => e.id)).toEqual(['b', 'a'])
  })

  it('puede filtrar por status', () => {
    const events = [
      ev({ id: 'a', status: 'in_progress' }),
      ev({ id: 'b', status: 'completed' }),
    ]
    expect(getSlotAndenEvents(events, '2026-05-27', '06:30', 'in_progress').map((e) => e.id)).toEqual(['a'])
    expect(getSlotAndenEvents(events, '2026-05-27', '06:30', 'completed').map((e) => e.id)).toEqual(['b'])
  })
})

describe('mergePhotoIds', () => {
  it('combina ids existentes conservados con los nuevos', () => {
    expect(mergePhotoIds(['p1', 'p2'], ['p3'])).toEqual(['p1', 'p2', 'p3'])
  })
  it('si no hay nuevas, devuelve solo las existentes', () => {
    expect(mergePhotoIds(['p1'], [])).toEqual(['p1'])
  })
})
