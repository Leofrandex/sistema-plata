import type { OutboxOpType } from '../offline-queue'

/** Mapa de ops de tabla simple → nombre de tabla. Su payload es la fila completa
 *  (con id de cliente). Se upserta con onConflict 'id'. Usado por la migración
 *  del outbox IndexedDB legacy hacia el LocalStore. */
export const TABLE_FOR_TYPE: Partial<Record<OutboxOpType, string>> = {
  create_route_event: 'route_events',
  create_weighing_session: 'weighing_sessions',
  create_reception: 'container_receptions',
  create_treatment_run: 'treatment_runs',
  create_container_location: 'container_locations',
  create_storage_event: 'storage_events',
}

/** ¿El error proviene de falta de conexión (no de un rechazo del servidor)? */
export function isNetworkError(err: unknown): boolean {
  if (err instanceof TypeError) return true // fetch lanza TypeError sin red
  const msg = err instanceof Error ? err.message : String(err)
  return /failed to fetch|fetch failed|load failed|networkerror/i.test(msg)
}
