import type { Photo } from '../types'
import * as q from '../supabase/queries'
import type { DB } from '../supabase/queries/_helpers'
import type { PhotoEventType } from '../supabase/queries/photos'
import { putPhotoBlob, enqueueOp } from '../offline-queue'

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

// ─── Offline local-first (Plan B: cableado offline) ──────────────────────────

export interface EnqueuePhotoArgs {
  dataUrls: (string | null | undefined)[]
  eventType: 'route' | 'weighing' | 'storage' | 'treatment' | 'other'
  eventId: string
  label: string
  uploadedBy?: string | null
  takenAt?: string
  role?: string | null
  parentOpId: string
}

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

/**
 * Versión local-first de uploadEventPhotos: NO sube a la red. Guarda el blob en
 * IndexedDB y encola una op `upload_photo` por foto (dep = parentOpId). Devuelve
 * objetos Photo con object URL local para mostrar al instante.
 */
export async function enqueueEventPhotos(args: EnqueuePhotoArgs): Promise<Photo[]> {
  const out: Photo[] = []
  const takenAt = args.takenAt ?? new Date().toISOString()
  for (const dataUrl of args.dataUrls) {
    if (!dataUrl) continue
    const photoId = crypto.randomUUID()
    const blob = dataUrlToBlob(dataUrl)
    const ext = blobExt(blob.type)
    await putPhotoBlob({ photo_id: photoId, blob, content_type: blob.type || 'image/jpeg' })
    await enqueueOp({
      op_id: `photo:${photoId}`,
      type: 'upload_photo',
      payload: {
        photo_id: photoId, event_type: args.eventType, event_id: args.eventId,
        label: args.label, uploaded_by: args.uploadedBy ?? null, taken_at: takenAt,
        role: args.role ?? null, ext,
      },
      deps: [args.parentOpId],
    })
    out.push({
      id: photoId,
      url: URL.createObjectURL(blob),
      event_type: args.eventType,
      event_id: args.eventId,
      taken_at: takenAt,
      label: args.label,
    })
  }
  return out
}
