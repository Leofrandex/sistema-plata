import type { Tables, TablesUpdate } from '../database.types'
import { unwrap, unwrapOrNull, type DB } from './_helpers'

export type ProfileRow = Tables<'profiles'>

/**
 * Devuelve el profile del usuario autenticado actual, o null si no hay sesión.
 * Llama internamente a auth.getUser() para validar el JWT contra el servidor.
 */
export async function getCurrentProfile(db: DB): Promise<ProfileRow | null> {
  const { data: userRes, error: authErr } = await db.auth.getUser()
  if (authErr || !userRes.user) return null
  return unwrapOrNull(
    await db.from('profiles').select('*').eq('id', userRes.user.id).maybeSingle()
  )
}

export async function listProfiles(db: DB): Promise<ProfileRow[]> {
  return unwrap(await db.from('profiles').select('*').order('name'))
}

export async function updateProfile(
  db: DB,
  id: string,
  patch: TablesUpdate<'profiles'>
): Promise<ProfileRow> {
  return unwrap(await db.from('profiles').update(patch).eq('id', id).select().single())
}
