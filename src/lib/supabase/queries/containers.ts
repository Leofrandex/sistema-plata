import type { Tables, TablesInsert, TablesUpdate } from '../database.types'
import { unwrap, unwrapOrNull, type DB } from './_helpers'

export type ContainerRow = Tables<'containers'>

export async function listContainers(db: DB): Promise<ContainerRow[]> {
  return unwrap(await db.from('containers').select('*').order('id'))
}

export async function listActiveContainers(db: DB): Promise<ContainerRow[]> {
  return unwrap(
    await db.from('containers').select('*').eq('status', 'active').order('id')
  )
}

export async function getContainer(db: DB, id: string): Promise<ContainerRow | null> {
  return unwrapOrNull(
    await db.from('containers').select('*').eq('id', id).maybeSingle()
  )
}

export async function createContainer(
  db: DB,
  input: TablesInsert<'containers'>
): Promise<ContainerRow> {
  return unwrap(await db.from('containers').insert(input).select().single())
}

export async function updateContainer(
  db: DB,
  id: string,
  patch: TablesUpdate<'containers'>
): Promise<ContainerRow> {
  return unwrap(
    await db.from('containers').update(patch).eq('id', id).select().single()
  )
}
