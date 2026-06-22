import type { DB } from './supabase/queries/_helpers'
import { getPhotoBlob, type OutboxOp, type OutboxOpType, listOps, removeOp, bumpAttempts, removePhotoBlob } from './offline-queue'

/** Mapa de ops de tabla simple → nombre de tabla. Su payload es la fila completa
 *  (con id de cliente). Se upserta con onConflict 'id'. */
export const TABLE_FOR_TYPE: Partial<Record<OutboxOpType, string>> = {
  create_route_event: 'route_events',
  create_weighing_session: 'weighing_sessions',
  create_reception: 'container_receptions',
  create_treatment_run: 'treatment_runs',
  create_container_location: 'container_locations',
  create_storage_event: 'storage_events',
}

const BUCKET = 'photos'

/** ¿El error proviene de falta de conexión (no de un rechazo del servidor)? */
export function isNetworkError(err: unknown): boolean {
  if (err instanceof TypeError) return true // fetch lanza TypeError sin red
  const msg = err instanceof Error ? err.message : String(err)
  return /failed to fetch|network|fetch failed|load failed/i.test(msg)
}

/**
 * Aplica una operación contra Supabase de forma idempotente. Lanza si Supabase
 * devuelve error; el llamador (drainOutbox) clasifica red vs no-red.
 */
export async function applyOp(db: DB, op: OutboxOp): Promise<void> {
  if (op.type === 'upload_photo') return applyUploadPhoto(db, op)
  if (op.type === 'add_route_containers') return applyRouteContainers(db, op)

  const table = TABLE_FOR_TYPE[op.type]
  if (!table) throw new Error(`applyOp: tipo no soportado ${op.type}`)
  const { error } = await db.from(table).upsert(op.payload, { onConflict: 'id' })
  if (error) throw new Error(`${table} upsert: ${error.message}`)
}

async function applyRouteContainers(db: DB, op: OutboxOp): Promise<void> {
  const table = op.payload.table as string
  const rows = op.payload.rows as Record<string, unknown>[]
  if (rows.length === 0) return
  const { error } = await db.from(table).upsert(rows, { onConflict: 'route_event_id,container_id' })
  if (error) throw new Error(`${table} upsert: ${error.message}`)
}

export interface DrainResult { synced: number; remaining: number; stuck: number }

/**
 * Drena el outbox respetando dependencias. Una op solo corre cuando todas sus
 * deps ya salieron de la cola. Error de red → detiene (reintentar luego, sin
 * contar intento). Error no-red → cuenta intento y sigue con las demás (no
 * bloquea independientes). Reintento indefinido: las atascadas quedan en cola.
 */
export async function drainOutbox(db: DB): Promise<DrainResult> {
  let synced = 0
  let stuck = 0
  const stuckIds = new Set<string>() // ops que fallaron (no-red) en esta sesión

  // Iteramos por rondas: en cada ronda aplicamos las ops "listas" (deps fuera de
  // la cola) que no estén marcadas como atascadas en esta pasada. Paramos cuando
  // una ronda no logra progreso o cae la red.
  for (;;) {
    const ops = await listOps()
    const pendingIds = new Set(ops.map((o) => o.op_id))
    // Ops listas: deps ya fuera de la cola, y la op misma no atascada en esta sesión
    const ready = ops.filter(
      (o) => !stuckIds.has(o.op_id) && o.deps.every((d) => !pendingIds.has(d)),
    )
    if (ready.length === 0) break

    let progressed = false
    let networkDown = false

    for (const op of ready) {
      try {
        await applyOp(db, op)
        await removeOp(op.op_id)
        if (op.type === 'upload_photo') {
          await removePhotoBlob((op.payload as { photo_id: string }).photo_id)
        }
        synced++
        progressed = true
      } catch (err) {
        if (isNetworkError(err)) { networkDown = true; break }
        await bumpAttempts(op.op_id) // no-red: reintento indefinido, no bloquea
        stuckIds.add(op.op_id)
        stuck++
      }
    }

    if (networkDown || !progressed) break
  }

  const remaining = (await listOps()).length
  return { synced, remaining, stuck }
}

async function applyUploadPhoto(db: DB, op: OutboxOp): Promise<void> {
  const p = op.payload as {
    photo_id: string; event_type: string; event_id: string; label: string
    uploaded_by: string | null; taken_at: string; role: string | null; ext: string
  }
  const entry = await getPhotoBlob(p.photo_id)
  if (!entry) throw new Error(`upload_photo: blob ausente para ${p.photo_id}`)

  // Ruta determinística por photo_id → reintentos sobreescriben, no duplican.
  const path = `${p.event_type}/${p.event_id}/${p.photo_id}.${p.ext}`
  const up = await db.storage.from(BUCKET).upload(path, entry.blob, {
    contentType: entry.content_type,
    upsert: true,
  })
  if (up.error) throw new Error(`storage upload: ${up.error.message}`)

  const row = {
    id: p.photo_id, storage_path: path, event_type: p.event_type, event_id: p.event_id,
    label: p.label, uploaded_by: p.uploaded_by, taken_at: p.taken_at, role: p.role,
  }
  const { error } = await db.from('photos').upsert(row, { onConflict: 'id' })
  if (error) throw new Error(`photos upsert: ${error.message}`)
}
