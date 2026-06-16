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

export type SlotStatus = 'available' | 'in_progress' | 'completed'

export interface SlotStatusDecision {
  status: SlotStatus
  startedAt?: string | null
  completedAt?: string | null
  /**
   * true cuando existe una sesión local (IndexedDB) para el horario PERO la BD
   * indica que ya está cerrado (hay andenes completed y ninguno in_progress).
   * Señala que esa sesión local quedó colgada y hay que limpiarla.
   */
  staleLocalSession: boolean
}

/**
 * Decide el estado de un horario de andén combinando la fuente de verdad (los
 * route_events en Supabase, ya hidratados al store) con la sesión local de
 * IndexedDB que sostiene el cronómetro.
 *
 * Regla clave: **la BD manda sobre la sesión local**. Si hay andenes completados
 * y ninguno en curso, el horario está cerrado aunque haya quedado una
 * `ActiveSession` colgada en IndexedDB (p. ej. la sesión se finalizó en otro
 * dispositivo, o se compartió el mismo navegador entre operador y coordinador).
 * Sin esta regla, un slot ya `completed` en Supabase se mostraba "en curso"
 * indefinidamente. La sesión local solo fuerza "en curso" cuando el operador
 * inició el recorrido pero todavía no guardó ningún andén.
 */
export function computeSlotStatus(
  routeEvents: RouteEvent[],
  date: string,
  slot: RouteSlot,
  localSessionStartedAt: string | null,
): SlotStatusDecision {
  const inProgress = getSlotAndenEvents(routeEvents, date, slot, 'in_progress')
  const completed = getSlotAndenEvents(routeEvents, date, slot, 'completed')

  if (completed.length > 0 && inProgress.length === 0) {
    return {
      status: 'completed',
      completedAt: completed[completed.length - 1].ended_at,
      staleLocalSession: localSessionStartedAt != null,
    }
  }

  if (localSessionStartedAt != null || inProgress.length > 0) {
    return {
      status: 'in_progress',
      startedAt: localSessionStartedAt ?? inProgress[0]?.started_at ?? null,
      staleLocalSession: false,
    }
  }

  return { status: 'available', staleLocalSession: false }
}
