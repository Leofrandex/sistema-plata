import type { RouteEvent, RouteSlot, RouteEventStatus } from '@/lib/types'

/**
 * Devuelve los route_events de andén que pertenecen a la "sesión" de un
 * horario/día (mismo date + slot + kind='anden'), ordenados por started_at.
 * Opcionalmente filtra por status.
 */
export function getSlotAndenEvents(
  routeEvents: RouteEvent[],
  date: string,
  slot: RouteSlot,
  status?: RouteEventStatus,
): RouteEvent[] {
  return routeEvents
    .filter(
      (r) =>
        r.kind === 'anden' &&
        r.slot === slot &&
        r.date === date &&
        (status ? r.status === status : true),
    )
    .sort((a, b) => new Date(a.started_at).getTime() - new Date(b.started_at).getTime())
}

/** Combina los photo_ids existentes (conservados) con los recién subidos. */
export function mergePhotoIds(existing: string[], added: string[]): string[] {
  return [...existing, ...added]
}
