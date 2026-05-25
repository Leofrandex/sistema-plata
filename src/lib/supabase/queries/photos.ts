import type { Tables, TablesInsert } from '../database.types'
import { unwrap, type DB } from './_helpers'

export type PhotoRow = Tables<'photos'>
export type PhotoEventType = PhotoRow['event_type']

const BUCKET = 'photos'
// 24 h: cubre cómodamente una jornada de pilotaje + la generación de reportes
// posteriores sin que el operador tenga que recargar para refrescar las URLs.
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24

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

/**
 * Variante de `uploadPhoto` que recibe un data URL (`data:image/...;base64,...`),
 * tal como lo producen los componentes de captura (`PhotoCapture` /
 * `PhotoCaptureMulti` vía `FileReader.readAsDataURL`). Convierte a Blob y sube.
 */
export async function uploadPhotoFromDataUrl(
  db: DB,
  args: {
    dataUrl: string
    eventType: PhotoEventType
    eventId: string
    label?: string
    uploadedBy?: string | null
    takenAt?: string
  }
): Promise<PhotoRow> {
  const file = dataUrlToBlob(args.dataUrl)
  const { dataUrl: _omit, ...rest } = args
  void _omit
  return uploadPhoto(db, { ...rest, file })
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

/** Trae todas las fotos (para hidratar el store al arrancar). */
export async function listAllPhotos(db: DB): Promise<PhotoRow[]> {
  return unwrap(await db.from('photos').select('*').order('taken_at'))
}

/**
 * Genera URLs firmadas en lote para un conjunto de fotos. Devuelve un Map
 * `photo.id → url` resoluble (firmada o `url` directa legacy). Las fotos cuya
 * firma falle se omiten del Map.
 */
export async function getPhotoUrls(
  db: DB,
  photos: PhotoRow[]
): Promise<Map<string, string>> {
  const result = new Map<string, string>()
  const toSign: PhotoRow[] = []

  for (const p of photos) {
    if (p.url) result.set(p.id, p.url)
    else if (p.storage_path) toSign.push(p)
  }

  if (toSign.length > 0) {
    const { data, error } = await db.storage
      .from(BUCKET)
      .createSignedUrls(
        toSign.map((p) => p.storage_path as string),
        SIGNED_URL_TTL_SECONDS
      )
    if (error) throw new Error(`Signed URLs failed: ${error.message}`)
    data.forEach((res, idx) => {
      if (res.signedUrl) result.set(toSign[idx].id, res.signedUrl)
    })
  }

  return result
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

/** Convierte un data URL (`data:image/jpeg;base64,...`) a Blob. */
function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64] = dataUrl.split(',')
  const mimeMatch = /data:([^;]+)/.exec(header)
  const mime = mimeMatch?.[1] ?? 'image/jpeg'
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new Blob([bytes], { type: mime })
}

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
