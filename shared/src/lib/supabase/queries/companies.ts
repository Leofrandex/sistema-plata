import type { Tables, TablesInsert } from '../database.types'
import { unwrap, unwrapOrNull, type DB } from './_helpers'

export type CompanyRow = Tables<'companies'>

export async function listCompanies(db: DB): Promise<CompanyRow[]> {
  return unwrap(await db.from('companies').select('*').order('name'))
}

export async function listCompaniesByClient(
  db: DB,
  clientId: string
): Promise<CompanyRow[]> {
  return unwrap(
    await db.from('companies').select('*').eq('client_id', clientId).order('name')
  )
}

export async function getCompany(db: DB, id: string): Promise<CompanyRow | null> {
  return unwrapOrNull(
    await db.from('companies').select('*').eq('id', id).maybeSingle()
  )
}

export async function createCompany(
  db: DB,
  input: TablesInsert<'companies'>
): Promise<CompanyRow> {
  return unwrap(await db.from('companies').insert(input).select().single())
}
