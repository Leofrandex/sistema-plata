import { rowToStorageEvent, rowToTreatmentRun, rowToExternalTransfer, rowToLocation } from '@hospiwaste/shared/components/supabase-hydrator'
import type { StorageEventRow, ContainerLocationRow, ExternalTransferRow } from '@hospiwaste/shared/lib/supabase/queries'
import type { TreatmentRunRow } from '@hospiwaste/shared/lib/supabase/queries'

describe('hydrate adapters', () => {
  it('rowToStorageEvent mapea campos y deja photo_ids vacío', () => {
    const row: StorageEventRow = {
      id: 'st-1', container_id: '001', entry_at: '2026-06-10T10:00:00Z',
      exit_at: null, operator_id: 'op-1', created_at: '2026-06-10T10:00:00Z',
    }
    expect(rowToStorageEvent(row)).toEqual({
      id: 'st-1', container_id: '001', entry_at: '2026-06-10T10:00:00Z',
      exit_at: null, operator_id: 'op-1', photo_ids: [],
    })
  })

  it('rowToTreatmentRun mapea started/completed', () => {
    const row: TreatmentRunRow = {
      id: 'tr-1', container_id: '001', started_at: '2026-06-10T11:00:00Z',
      completed_at: '2026-06-10T11:00:00Z', operator_id: 'op-1', created_at: '2026-06-10T11:00:00Z',
    }
    expect(rowToTreatmentRun(row)).toEqual({
      id: 'tr-1', container_id: '001', started_at: '2026-06-10T11:00:00Z',
      completed_at: '2026-06-10T11:00:00Z', operator_id: 'op-1',
    })
  })

  it('rowToLocation mapea todos los campos nullables', () => {
    const row: ContainerLocationRow = {
      id: 'loc-1', container_id: '001', reported_at: '2026-06-10T11:00:00Z',
      operator_id: 'op-1', location_type: 'cold_storage', client_id: null,
      floor: null, area: null, notes: 'Cámara fría',
    }
    expect(rowToLocation(row)).toEqual(row)
  })

  it('rowToExternalTransfer mapea destino', () => {
    const row: ExternalTransferRow = {
      id: 'xf-1', container_id: '001', storage_started_at: '2026-06-10T11:00:00Z',
      transferred_at: null, destination: 'Centro X', operator_id: 'op-1', created_at: '2026-06-10T11:00:00Z',
    }
    expect(rowToExternalTransfer(row)).toEqual({
      id: 'xf-1', container_id: '001', storage_started_at: '2026-06-10T11:00:00Z',
      transferred_at: null, destination: 'Centro X', operator_id: 'op-1',
    })
  })
})
