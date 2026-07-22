import type { Tables, TablesInsert } from '../database.types'
import { unwrap, unwrapOrNull, type DB } from './_helpers'

export type ClientRow = Tables<'clients'>
export type ClientLocationRow = Tables<'client_locations'>

export async function listClients(db: DB): Promise<ClientRow[]> {
  return unwrap(await db.from('clients').select('*').order('name'))
}

export async function getClient(db: DB, id: string): Promise<ClientRow | null> {
  return unwrapOrNull(
    await db.from('clients').select('*').eq('id', id).maybeSingle()
  )
}

export async function listClientLocations(
  db: DB,
  clientId: string
): Promise<ClientLocationRow[]> {
  return unwrap(
    await db
      .from('client_locations')
      .select('*')
      .eq('client_id', clientId)
      .order('floor')
  )
}

export async function createClient(
  db: DB,
  input: TablesInsert<'clients'>
): Promise<ClientRow> {
  return unwrap(await db.from('clients').insert(input).select().single())
}
