import type { DB } from '../supabase/queries/_helpers'
import { isNetworkError } from './net'
import { ON_CONFLICT, PARENT_OF, sortBySyncOrder, type DomainTable, type LocalPhoto, type LocalRow, type LocalStore } from './types'

export const REQUEST_TIMEOUT_MS = 15_000
const BUCKET = 'photos'

export interface FlushResult {
  pushedRecords: number
  pushedPhotos: number
  failed: number
  skipped: boolean
}

/** Con señal débil un fetch puede colgar minutos; expirar = fallo de red del ítem. */
export function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new TypeError(`request timeout tras ${ms}ms`)), ms)
    p.then((v) => { clearTimeout(t); resolve(v) }, (e) => { clearTimeout(t); reject(e) })
  })
}

let isFlushing = false

/**
 * Fase 1: filas de dominio en SYNC_ORDER (una hija solo sube si su padre quedó
 * synced en esta pasada o antes). Fase 2: fotos de registros ya sincronizados.
 * Mutex simple; error de red aborta la pasada, rechazo marca la fila y sigue.
 */
export async function flush(
  db: DB,
  store: LocalStore,
  opts: { timeoutMs?: number } = {},
): Promise<FlushResult> {
  if (isFlushing) return { pushedRecords: 0, pushedPhotos: 0, failed: 0, skipped: true }
  isFlushing = true
  const timeoutMs = opts.timeoutMs ?? REQUEST_TIMEOUT_MS
  const result: FlushResult = { pushedRecords: 0, pushedPhotos: 0, failed: 0, skipped: false }

  try {
    const rows = sortBySyncOrder(await store.getUnsyncedRows())
    const failedParents = new Set<string>() // `${tbl}:${id}` que fallaron en esta pasada

    for (const row of rows) {
      if (await parentBlocked(store, row, failedParents)) { continue }
      const revAtRead = row.rev // si un putRow concurrente mueve la rev, la fila queda pendiente y re-flushea
      try {
        await pushRow(db, row, timeoutMs)
        await store.markRowSynced(row.tbl, row.id, revAtRead)
        result.pushedRecords++
      } catch (err) {
        if (isNetworkError(err)) return result // red caída: reintentar en el próximo trigger
        await store.markRowFailed(row.tbl, row.id, err instanceof Error ? err.message : String(err))
        failedParents.add(`${row.tbl}:${row.id}`)
        result.failed++
      }
    }

    for (const photo of await store.getUnsyncedPhotos()) {
      const parentTable = photo.event_type === 'route' ? 'route_events'
        : photo.event_type === 'weighing' ? 'container_receptions'
        : null
      if (parentTable && (await photoParentBlocked(store, parentTable, photo.event_id))) continue
      try {
        await pushPhoto(db, store, photo, timeoutMs)
        await store.markPhotoSynced(photo.photo_id)
        result.pushedPhotos++
      } catch (err) {
        if (isNetworkError(err)) return result
        await store.markPhotoFailed(photo.photo_id, err instanceof Error ? err.message : String(err))
        result.failed++
      }
    }
    return result
  } finally {
    isFlushing = false
  }
}

async function parentBlocked(store: LocalStore, row: LocalRow, failedNow: Set<string>): Promise<boolean> {
  const parent = PARENT_OF[row.tbl]
  if (!parent) return false
  const parentId = (row.payload[parentFk(row.tbl)] as string) ?? ''
  if (failedNow.has(`${parent}:${parentId}`)) return true
  // Si el padre no existe local (histórico ya en server), no bloquea.
  const parentRows = await store.getRows(parent)
  const local = parentRows.find((r) => r.id === parentId)
  return local ? !local.synced : false
}

function parentFk(tbl: DomainTable): string {
  return tbl === 'container_receptions' ? 'weighing_session_id' : 'route_event_id'
}

/** Misma semántica que parentBlocked: sin fila padre local (histórico ya en server) no bloquea. */
async function photoParentBlocked(store: LocalStore, parentTable: DomainTable, eventId: string): Promise<boolean> {
  const parentRows = await store.getRows(parentTable)
  const local = parentRows.find((r) => r.id === eventId)
  return local ? !local.synced : false
}

async function pushRow(db: DB, row: LocalRow, timeoutMs: number): Promise<void> {
  const { error } = await withTimeout(
    Promise.resolve(db.from(row.tbl as never).upsert(row.payload as never, { onConflict: ON_CONFLICT[row.tbl] })),
    timeoutMs,
  )
  if (error) throw new Error(`${row.tbl} upsert: ${error.message}`)
}

async function pushPhoto(db: DB, store: LocalStore, p: LocalPhoto, timeoutMs: number): Promise<void> {
  const blob = await store.getPhotoBlob(p.photo_id)
  if (!blob) throw new Error(`foto ${p.photo_id}: binario ausente`)
  const path = `${p.event_type}/${p.event_id}/${p.photo_id}.${p.ext}`
  const up = await withTimeout(
    Promise.resolve(db.storage.from(BUCKET).upload(path, blob, { contentType: p.content_type, upsert: true })),
    timeoutMs,
  )
  if (up.error) throw new Error(`storage upload: ${up.error.message}`)
  const row = {
    id: p.photo_id, storage_path: path, event_type: p.event_type, event_id: p.event_id,
    label: p.label, uploaded_by: p.uploaded_by, taken_at: p.taken_at, role: p.role,
  }
  const { error } = await withTimeout(
    Promise.resolve(db.from('photos').upsert(row as never, { onConflict: 'id' })),
    timeoutMs,
  )
  if (error) throw new Error(`photos upsert: ${error.message}`)
}
