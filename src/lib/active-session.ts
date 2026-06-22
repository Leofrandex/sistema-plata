import { getDB } from './idb'
import type { RouteKind, RouteSlot } from './types'

/**
 * Sesión activa persistida en IndexedDB. Permite que el cronómetro de un
 * recorrido o pesaje sobreviva al cierre de la aplicación: al volver, se
 * recalcula el elapsed como `Date.now() - started_at`.
 *
 * Diseño:
 * - Se reutiliza la misma DB que offline-queue (`hospiwaste-offline`) con un
 *   store distinto `active_sessions`.
 * - La key es un string compuesto que identifica el contexto:
 *     `route:{YYYY-MM-DD}:{slot}` para recorridos
 *     `weighing:{YYYY-MM-DD}` para sesiones de pesaje
 * - Solo puede existir una entrada por key. Si ya hay una activa se devuelve.
 */

const STORE_NAME = 'active_sessions'

export type SessionType = 'route' | 'weighing'

export interface RouteSessionContext {
  type: 'route'
  client_id: string
  company_id?: string | null   // empresa (ION/Airkem) elegida para la sesión de recorrido
  kind: RouteKind
  slot: RouteSlot | null
  date: string
  operator_id: string
  route_event_id: string
}

export interface WeighingSessionContext {
  type: 'weighing'
  client_id: string
  date: string
  operator_id: string
  weighing_session_id: string
  /** Tachos marcados ausentes en esta sesión (permiten finalizar; siguen en la
   *  cola para la próxima). Transitorio, no se persiste en BD. */
  skipped?: { container_id: string; note: string }[]
}

export type SessionContext = RouteSessionContext | WeighingSessionContext

export interface ActiveSession {
  key: string
  type: SessionType
  started_at: string // ISO datetime
  context: SessionContext
}

export function routeAndenSessionKey(date: string, slot: RouteSlot): string {
  return `route:anden:${date}:${slot}`
}

export function routeMorgueSessionKey(date: string, startedAt: string): string {
  // Morgue puede tener más de uno por día. Distinguimos por started_at.
  return `route:morgue:${date}:${startedAt}`
}

export function weighingSessionKey(date: string): string {
  return `weighing:${date}`
}

export async function startSession(session: ActiveSession): Promise<void> {
  const db = await getDB()
  await db.put(STORE_NAME, session)
}

export async function getActiveSession(key: string): Promise<ActiveSession | undefined> {
  const db = await getDB()
  return db.get(STORE_NAME, key)
}

export async function endSession(key: string): Promise<void> {
  const db = await getDB()
  await db.delete(STORE_NAME, key)
}

export async function listActiveSessions(type?: SessionType): Promise<ActiveSession[]> {
  const db = await getDB()
  const all: ActiveSession[] = await db.getAll(STORE_NAME)
  if (!type) return all
  return all.filter((s) => s.type === type)
}

/** Helper: devuelve la fecha local en formato `YYYY-MM-DD`. */
export function todayLocal(): string {
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}
