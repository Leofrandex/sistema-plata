import type { Tables, TablesInsert } from '../database.types'
import { unwrap, type DB } from './_helpers'

export type StorageEventRow = Tables<'storage_events'>
export type ContainerLocationRow = Tables<'container_locations'>
export type ExternalTransferRow = Tables<'external_transfers'>

// ─── storage_events ──────────────────────────────────────────────────────────

export async function createStorageEvent(
  db: DB,
  input: TablesInsert<'storage_events'>,
): Promise<StorageEventRow> {
  return unwrap(await db.from('storage_events').insert(input).select().single())
}

export async function listStorageEvents(db: DB): Promise<StorageEventRow[]> {
  return unwrap(await db.from('storage_events').select('*').order('entry_at'))
}

// ─── container_locations ─────────────────────────────────────────────────────

export async function createContainerLocation(
  db: DB,
  input: TablesInsert<'container_locations'>,
): Promise<ContainerLocationRow> {
  return unwrap(await db.from('container_locations').insert(input).select().single())
}

export async function listContainerLocations(db: DB): Promise<ContainerLocationRow[]> {
  return unwrap(await db.from('container_locations').select('*').order('reported_at'))
}

// ─── external_transfers ──────────────────────────────────────────────────────

export async function listExternalTransfers(db: DB): Promise<ExternalTransferRow[]> {
  return unwrap(await db.from('external_transfers').select('*').order('storage_started_at'))
}
