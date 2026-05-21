import type { Tables, TablesInsert } from '../database.types'
import { unwrap, type DB } from './_helpers'

export type PhotoRow = Tables<'photos'>
export type PhotoEventType = PhotoRow['event_type']

const BUCKET = 'photos'
const SIGNED_URL_TTL_SECONDS = 60 * 60 // 1 h

/**
 * Sube un archivo al bucket `photos` y registra la fila en `public.photos`.
 *
 * @param file       File/Blob desde el input/captura.
 * @param eventType  Tipo de evento ('route' | 'weighing' | ...).
 * @param eventId    FK polimórfico al evento dueño de la foto.
 * @param label      Texto descriptivo (ej. "PTDP Centro Salud 21/05/2026 09:40 PM").
 * @param uploadedBy uuid del operador (opcional; si null, se usa el current user).
 */
export async function uploadPhoto(
  db: DB,
  args: {
    file: Blob
    eventType: PhotoEventType
    eventId: string
    label?: string
    uploadedBy?: string | null
    takenAt?: string
  }
): Promise<PhotoRow> {
  const ext = blobExtension(args.file)
  // Path: {eventType}/{eventId}/{timestamp}-{rand}.{ext}
  const rand = Math.random().toString(36).slice(2, 10)
  const path = `${args.eventType}/${args.eventId}/${Date.now()}-${rand}.${ext}`

  const up = await db.storage.from(BUCKET).upload(path, args.file, {
    contentType: args.file.type || `image/${ext}`,
    upsert: false,
  })
  if (up.error) throw new Error(`Storage upload failed: ${up.error.message}`)

  const insert: TablesInsert<'photos'> = {
    storage_path: path,
    event_type: args.eventType,
    event_id: args.eventId,
    label: args.label ?? '',
    uploaded_by: args.uploadedBy ?? null,
    taken_at: args.takenAt ?? new Date().toISOString(),
  }
  return unwrap(await db.from('photos').insert(insert).select().single())
}

export async function listPhotosByEvent(
  db: DB,
  eventType: PhotoEventType,
  eventId: string
): Promise<PhotoRow[]> {
  return unwrap(
    await db
      .from('photos')
      .select('*')
      .eq('event_type', eventType)
      .eq('event_id', eventId)
      .order('taken_at')
  )
}

/**
 * Devuelve una URL firmada (TTL 1h) para renderizar la foto en el browser.
 * Si la foto tiene `url` directa (legacy/externa) se devuelve esa.
 */
export async function getPhotoUrl(db: DB, photo: PhotoRow): Promise<string> {
  if (photo.url) return photo.url
  if (!photo.storage_path) throw new Error('Photo has no storage_path nor url')
  const res = await db.storage
    .from(BUCKET)
    .createSignedUrl(photo.storage_path, SIGNED_URL_TTL_SECONDS)
  if (res.error) throw new Error(`Signed URL failed: ${res.error.message}`)
  return res.data.signedUrl
}

export async function deletePhoto(db: DB, photoId: string): Promise<void> {
  // Borrar fila primero; si tiene storage_path, borrar también del bucket.
  const fetched = await db.from('photos').select('storage_path').eq('id', photoId).maybeSingle()
  if (fetched.error) throw new Error(fetched.error.message)
  const path = fetched.data?.storage_path
  const { error } = await db.from('photos').delete().eq('id', photoId)
  if (error) throw new Error(error.message)
  if (path) {
    await db.storage.from(BUCKET).remove([path]) // best-effort
  }
}

// ─── helpers ────────────────────────────────────────────────────────────────

function blobExtension(file: Blob): string {
  const map: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/heic': 'heic',
  }
  return map[file.type] ?? 'jpg'
}
