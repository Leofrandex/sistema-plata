import type { Tables, TablesInsert, TablesUpdate } from '../database.types'
import { unwrap, unwrapOrNull, type DB } from './_helpers'

export type EquipmentRow = Tables<'equipment'>
export type EquipmentMaintenanceRow = Tables<'equipment_maintenance'>

export async function listEquipment(db: DB): Promise<EquipmentRow[]> {
  return unwrap(
    await db.from('equipment').select('*').eq('active', true).order('name')
  )
}

export async function getEquipment(db: DB, id: string): Promise<EquipmentRow | null> {
  return unwrapOrNull(
    await db.from('equipment').select('*').eq('id', id).maybeSingle()
  )
}

export async function createEquipment(
  db: DB,
  input: TablesInsert<'equipment'>
): Promise<EquipmentRow> {
  return unwrap(await db.from('equipment').insert(input).select().single())
}

export async function updateEquipment(
  db: DB,
  id: string,
  patch: TablesUpdate<'equipment'>
): Promise<EquipmentRow> {
  return unwrap(
    await db.from('equipment').update(patch).eq('id', id).select().single()
  )
}

/** equipment_id → performed_at más reciente (solo mantenimientos no anulados). */
export async function listLatestMaintenanceByEquipment(db: DB): Promise<Map<string, string>> {
  const rows = unwrap(
    await db
      .from('equipment_maintenance')
      .select('equipment_id, performed_at')
      .is('voided_at', null)
  )
  const map = new Map<string, string>()
  for (const r of rows) {
    const prev = map.get(r.equipment_id)
    if (!prev || r.performed_at > prev) map.set(r.equipment_id, r.performed_at)
  }
  return map
}

/** Historial completo (incluye anulados, para mostrarlos tachados), más reciente primero. */
export async function listMaintenanceByEquipment(
  db: DB,
  equipmentId: string
): Promise<EquipmentMaintenanceRow[]> {
  return unwrap(
    await db
      .from('equipment_maintenance')
      .select('*')
      .eq('equipment_id', equipmentId)
      .order('performed_at', { ascending: false })
  )
}

export async function createMaintenance(
  db: DB,
  input: TablesInsert<'equipment_maintenance'>
): Promise<EquipmentMaintenanceRow> {
  return unwrap(
    await db.from('equipment_maintenance').insert(input).select().single()
  )
}

export async function voidMaintenance(
  db: DB,
  id: string,
  args: { voidedBy: string | null; reason: string }
): Promise<void> {
  unwrap(
    await db
      .from('equipment_maintenance')
      .update({
        voided_at: new Date().toISOString(),
        voided_by: args.voidedBy,
        voided_reason: args.reason,
      })
      .eq('id', id)
      .select()
      .single()
  )
}
