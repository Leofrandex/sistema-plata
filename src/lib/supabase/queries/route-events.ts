import type { Tables, TablesInsert, TablesUpdate } from '../database.types'
import { unwrap, unwrapOrNull, type DB } from './_helpers'

export type RouteEventRow = Tables<'route_events'>

export async function listRouteEvents(db: DB): Promise<RouteEventRow[]> {
  return unwrap(
    await db.from('route_events').select('*').order('date', { ascending: false })
  )
}

export async function listRouteEventsByDate(
  db: DB,
  date: string
): Promise<RouteEventRow[]> {
  return unwrap(
    await db.from('route_events').select('*').eq('date', date).order('started_at')
  )
}

export async function getRouteEvent(
  db: DB,
  id: string
): Promise<RouteEventRow | null> {
  return unwrapOrNull(
    await db.from('route_events').select('*').eq('id', id).maybeSingle()
  )
}

export async function createRouteEvent(
  db: DB,
  input: TablesInsert<'route_events'>
): Promise<RouteEventRow> {
  return unwrap(await db.from('route_events').insert(input).select().single())
}

export async function updateRouteEvent(
  db: DB,
  id: string,
  patch: TablesUpdate<'route_events'>
): Promise<RouteEventRow> {
  return unwrap(
    await db.from('route_events').update(patch).eq('id', id).select().single()
  )
}

export async function deleteRouteEvent(db: DB, id: string): Promise<void> {
  const { error } = await db.from('route_events').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

// ─── containers asociados al recorrido (join tables) ────────────────────────

export async function listContainersDirtyForRoute(
  db: DB,
  routeEventId: string
): Promise<string[]> {
  const rows = unwrap(
    await db
      .from('route_event_containers_dirty')
      .select('container_id')
      .eq('route_event_id', routeEventId)
  )
  return rows.map((r) => r.container_id)
}

export async function listContainersCleanForRoute(
  db: DB,
  routeEventId: string
): Promise<string[]> {
  const rows = unwrap(
    await db
      .from('route_event_containers_clean')
      .select('container_id')
      .eq('route_event_id', routeEventId)
  )
  return rows.map((r) => r.container_id)
}

export async function setRouteContainersDirty(
  db: DB,
  routeEventId: string,
  containerIds: string[]
): Promise<void> {
  const { error: delErr } = await db
    .from('route_event_containers_dirty')
    .delete()
    .eq('route_event_id', routeEventId)
  if (delErr) throw new Error(delErr.message)
  if (containerIds.length === 0) return
  const { error: insErr } = await db
    .from('route_event_containers_dirty')
    .insert(
      containerIds.map((container_id) => ({ route_event_id: routeEventId, container_id }))
    )
  if (insErr) throw new Error(insErr.message)
}

export async function setRouteContainersClean(
  db: DB,
  routeEventId: string,
  containerIds: string[]
): Promise<void> {
  const { error: delErr } = await db
    .from('route_event_containers_clean')
    .delete()
    .eq('route_event_id', routeEventId)
  if (delErr) throw new Error(delErr.message)
  if (containerIds.length === 0) return
  const { error: insErr } = await db
    .from('route_event_containers_clean')
    .insert(
      containerIds.map((container_id) => ({ route_event_id: routeEventId, container_id }))
    )
  if (insErr) throw new Error(insErr.message)
}
