import type { Photo } from '../types'
import * as q from '../supabase/queries'
import type { DB } from '../supabase/queries/_helpers'
import type { PhotoEventType } from '../supabase/queries/photos'

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
