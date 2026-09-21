import type { Tables } from '../database.types'
import { selectAll, type DB } from './_helpers'

export type StorageEventRow = Tables<'storage_events'>
export type ContainerLocationRow = Tables<'container_locations'>
export type ExternalTransferRow = Tables<'external_transfers'>

// ─── storage_events ──────────────────────────────────────────────────────────

export async function listStorageEvents(db: DB): Promise<StorageEventRow[]> {
  return selectAll<StorageEventRow>((desde, hasta) =>
    db.from('storage_events').select('*').order('entry_at').order('id').range(desde, hasta)
  )
}

// ─── container_locations ─────────────────────────────────────────────────────

export async function listContainerLocations(db: DB): Promise<ContainerLocationRow[]> {
  return selectAll<ContainerLocationRow>((desde, hasta) =>
    db
      .from('container_locations')
      .select('*')
      .order('reported_at')
      .order('id')
      .range(desde, hasta)
  )
}

// ─── external_transfers ──────────────────────────────────────────────────────

export async function listExternalTransfers(db: DB): Promise<ExternalTransferRow[]> {
  return selectAll<ExternalTransferRow>((desde, hasta) =>
    db
      .from('external_transfers')
      .select('*')
      .order('storage_started_at')
      .order('id')
      .range(desde, hasta)
  )
}
