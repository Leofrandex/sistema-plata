import type { Photo } from '@hospiwaste/shared/lib/types'
import * as q from '@hospiwaste/shared/lib/supabase/queries'
import type { DB } from '@hospiwaste/shared/lib/supabase/queries/_helpers'
import type { PhotoEventType } from '@hospiwaste/shared/lib/supabase/queries/photos'
import { getLocalStore } from '@hospiwaste/shared/lib/local-store'

/**
 * Sube una lista de data URLs a Storage, las registra en `public.photos` y
 * devuelve objetos `Photo` (forma del store) con su URL firmada lista para
 * mostrarse al instante.
 *
 * Best-effort: si una foto individual falla al subir, se registra el error y
 * se omite — no se aborta el resto ni el flujo que la invoca (cierre de
 * recorrido / recepción de pesaje).
 */
export async function uploadEventPhotos(
  db: DB,
  args: {
    dataUrls: (string | null | undefined)[]
    eventType: PhotoEventType
    eventId: string
    label: string
    uploadedBy?: string | null
    takenAt?: string
    role?: string | null
  }
): Promise<Photo[]> {
  const photos: Photo[] = []
  for (const dataUrl of args.dataUrls) {
    if (!dataUrl) continue
    try {
      const row = await q.uploadPhotoFromDataUrl(db, {
        dataUrl,
        eventType: args.eventType,
        eventId: args.eventId,
        label: args.label,
        uploadedBy: args.uploadedBy,
        takenAt: args.takenAt,
        role: args.role ?? null,
      })
      const url = await q.getPhotoUrl(db, row)
      photos.push({
        id: row.id,
        url,
        event_type: row.event_type,
        event_id: row.event_id,
        taken_at: row.taken_at,
        label: row.label,
      })
    } catch (err) {
      console.error('[fotos] subir foto falló:', err)
    }
  }
  return photos
}

// ─── Offline local-first ──────────────────────────────────────────────────────

/** Convierte un data URL a Blob (igual que el helper interno de queries/photos). */
function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64] = dataUrl.split(',')
  const mime = /data:([^;]+)/.exec(header)?.[1] ?? 'image/jpeg'
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new Blob([bytes], { type: mime })
}

function blobExt(type: string): string {
  const map: Record<string, string> = {
    'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/heic': 'heic',
  }
  return map[type] ?? 'jpg'
}

// ─── LocalStore: escritura directa a `local_photos` ──────────────────────────

/** event_type con el que el sync engine (`local-store/sync-engine.ts`) resuelve
 *  la tabla padre de cada foto: `route` → `route_events`,
 *  `weighing` → `container_receptions` (el event_id de una foto de pesaje ES
 *  el id de la recepción), `treatment` sin padre local. Subconjunto de
 *  `photo_event_type` (enum de la BD) usado por el flujo de campo. */
export type LocalPhotoEventType = 'route' | 'weighing' | 'treatment'

/**
 * Versión local-first de subida de fotos sobre el `LocalStore`: guarda el blob
 * y su metadata en `local_photos` (`synced=0`). Devuelve objetos `Photo` con
 * object URL local para mostrar al instante.
 */
export async function saveEventPhotosLocal(
  eventType: LocalPhotoEventType,
  eventId: string,
  photos: Array<{ dataUrl: string; label: string; role?: string | null }>,
  uploadedBy: string | null,
): Promise<Photo[]> {
  const store = await getLocalStore()
  const out: Photo[] = []
  for (const p of photos) {
    const photo_id = crypto.randomUUID()
    const blob = dataUrlToBlob(p.dataUrl)
    const ext = blobExt(blob.type)
    const taken_at = new Date().toISOString()
    await store.putPhoto({
      photo_id, event_type: eventType, event_id: eventId, label: p.label,
      uploaded_by: uploadedBy, taken_at, role: p.role ?? null, ext, content_type: blob.type || 'image/jpeg',
    }, blob)
    out.push({
      id: photo_id,
      url: URL.createObjectURL(blob),
      event_type: eventType,
      event_id: eventId,
      taken_at,
      label: p.label,
    })
  }
  return out
}
