import type { Tables, TablesInsert, TablesUpdate } from '../database.types'
import { unwrap, unwrapOrNull, type DB } from './_helpers'

export type WeighingSessionRow = Tables<'weighing_sessions'>
export type ReceptionRow = Tables<'container_receptions'>
export type ReceptionWithNetRow = Tables<'container_receptions_with_net'>

// ─── Sesiones ──────────────────────────────────────────────────────────────

export async function listWeighingSessions(db: DB): Promise<WeighingSessionRow[]> {
  return unwrap(
    await db
      .from('weighing_sessions')
      .select('*')
      .order('date', { ascending: false })
      .order('started_at', { ascending: false })
  )
}

export async function listActiveWeighingSessions(
  db: DB
): Promise<WeighingSessionRow[]> {
  return unwrap(
    await db
      .from('weighing_sessions')
      .select('*')
      .eq('status', 'in_progress')
      .order('started_at', { ascending: false })
  )
}

export async function getWeighingSession(
  db: DB,
  id: string
): Promise<WeighingSessionRow | null> {
  return unwrapOrNull(
    await db.from('weighing_sessions').select('*').eq('id', id).maybeSingle()
  )
}

export async function createWeighingSession(
  db: DB,
  input: TablesInsert<'weighing_sessions'>
): Promise<WeighingSessionRow> {
  return unwrap(await db.from('weighing_sessions').insert(input).select().single())
}

export async function updateWeighingSession(
  db: DB,
  id: string,
  patch: TablesUpdate<'weighing_sessions'>
): Promise<WeighingSessionRow> {
  return unwrap(
    await db.from('weighing_sessions').update(patch).eq('id', id).select().single()
  )
}

/**
 * Borra la sesión y todas las receptions asociadas (ON DELETE SET NULL en BD,
 * así que limpiamos explícitamente). Las fotos se manejan aparte.
 */
export async function deleteWeighingSession(db: DB, id: string): Promise<void> {
  const { error: recErr } = await db
    .from('container_receptions')
    .delete()
    .eq('weighing_session_id', id)
  if (recErr) throw new Error(recErr.message)
  const { error } = await db.from('weighing_sessions').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

// ─── Receptions ─────────────────────────────────────────────────────────────

export async function listReceptionsBySession(
  db: DB,
  sessionId: string
): Promise<ReceptionRow[]> {
  return unwrap(
    await db
      .from('container_receptions')
      .select('*')
      .eq('weighing_session_id', sessionId)
      .order('arrived_at')
  )
}

export async function listReceptionsWithNet(
  db: DB,
  opts: { from?: string; to?: string } = {}
): Promise<ReceptionWithNetRow[]> {
  let q = db
    .from('container_receptions_with_net')
    .select('*')
    .order('arrived_at', { ascending: false })
  if (opts.from) q = q.gte('arrived_at', opts.from)
  if (opts.to) q = q.lte('arrived_at', opts.to)
  return unwrap(await q)
}

export async function createReception(
  db: DB,
  input: TablesInsert<'container_receptions'>
): Promise<ReceptionRow> {
  return unwrap(
    await db.from('container_receptions').insert(input).select().single()
  )
}

export async function updateReception(
  db: DB,
  id: string,
  patch: TablesUpdate<'container_receptions'>
): Promise<ReceptionRow> {
  return unwrap(
    await db.from('container_receptions').update(patch).eq('id', id).select().single()
  )
}

export async function deleteReception(db: DB, id: string): Promise<void> {
  const { error } = await db.from('container_receptions').delete().eq('id', id)
  if (error) throw new Error(error.message)
}
