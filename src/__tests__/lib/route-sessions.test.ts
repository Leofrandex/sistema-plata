import { getSlotAndenEvents, mergePhotoIds, computeSlotStatus } from '@/lib/data/route-sessions'
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

describe('computeSlotStatus', () => {
  it('disponible cuando no hay route_events ni sesión local', () => {
    expect(computeSlotStatus([], '2026-05-27', '06:30', null)).toEqual({
      status: 'available',
      staleLocalSession: false,
    })
  })

  it('en curso cuando hay sesión local pero todavía ningún andén guardado', () => {
    const d = computeSlotStatus([], '2026-05-27', '06:30', '2026-05-27T06:30:00.000Z')
    expect(d.status).toBe('in_progress')
    expect(d.startedAt).toBe('2026-05-27T06:30:00.000Z')
    expect(d.staleLocalSession).toBe(false)
  })

  it('en curso cuando hay andenes in_progress', () => {
    const events = [ev({ id: 'a', status: 'in_progress', started_at: '2026-05-27T06:31:00.000Z' })]
    const d = computeSlotStatus(events, '2026-05-27', '06:30', null)
    expect(d.status).toBe('in_progress')
    expect(d.startedAt).toBe('2026-05-27T06:31:00.000Z')
  })

  it('completado cuando hay andenes completed y ninguno in_progress', () => {
    const events = [ev({ id: 'a', status: 'completed', ended_at: '2026-05-27T07:00:00.000Z' })]
    const d = computeSlotStatus(events, '2026-05-27', '06:30', null)
    expect(d.status).toBe('completed')
    expect(d.completedAt).toBe('2026-05-27T07:00:00.000Z')
    expect(d.staleLocalSession).toBe(false)
  })

  it('completado (la BD manda) aunque exista una sesión local colgada, y la marca como stale', () => {
    const events = [ev({ id: 'a', status: 'completed', ended_at: '2026-05-27T07:00:00.000Z' })]
    const d = computeSlotStatus(events, '2026-05-27', '06:30', '2026-05-27T06:30:00.000Z')
    expect(d.status).toBe('completed')
    expect(d.staleLocalSession).toBe(true)
  })

  it('sigue en curso si hay completados Y uno todavía in_progress', () => {
    const events = [
      ev({ id: 'a', status: 'completed', ended_at: '2026-05-27T07:00:00.000Z' }),
      ev({ id: 'b', status: 'in_progress', started_at: '2026-05-27T07:05:00.000Z' }),
    ]
    const d = computeSlotStatus(events, '2026-05-27', '06:30', null)
    expect(d.status).toBe('in_progress')
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
