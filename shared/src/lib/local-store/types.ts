/** Tablas Supabase que la app de campo escribe local-first. Orden = FK (padre antes que hijo). */
export const SYNC_ORDER = [
  'route_events',
  'route_event_containers_dirty',
  'route_event_containers_clean',
  'weighing_sessions',
  'container_receptions',
  'treatment_runs',
  'container_locations',
  'storage_events',
] as const

export type DomainTable = (typeof SYNC_ORDER)[number]

/** Tabla padre de cada hija: una fila hija solo sube cuando su padre está synced. */
export const PARENT_OF: Partial<Record<DomainTable, DomainTable>> = {
  route_event_containers_dirty: 'route_events',
  route_event_containers_clean: 'route_events',
  container_receptions: 'weighing_sessions',
}

/** Columna(s) de conflicto del upsert por tabla (todas 'id' salvo las join tables). */
export const ON_CONFLICT: Record<DomainTable, string> = {
  route_events: 'id',
  route_event_containers_dirty: 'route_event_id,container_id',
  route_event_containers_clean: 'route_event_id,container_id',
  weighing_sessions: 'id',
  container_receptions: 'id',
  treatment_runs: 'id',
  container_locations: 'id',
  storage_events: 'id',
}

export interface LocalRow {
  tbl: DomainTable
  id: string
  payload: Record<string, unknown>
  synced: boolean
  attempts: number
  sync_error: string | null
  created_at: string
  /** Versión local: putRow la incrementa. Permite a markRowSynced detectar escrituras concurrentes. */
  rev: number
}

export interface NewLocalPhoto {
  photo_id: string
  event_type: string
  event_id: string
  label: string
  uploaded_by: string | null
  taken_at: string
  role: string | null
  ext: string
  content_type: string
}

export interface LocalPhoto extends NewLocalPhoto {
  file_uri: string
  synced: boolean
  attempts: number
  sync_error: string | null
}

export interface PendingCounts {
  records: number   // local_rows con synced=0
  photos: number    // local_photos con synced=0
  rejected: number  // filas o fotos con sync_error != null
}

/** Contrato único: el motor de sync y la UI solo hablan con esto. */
export interface LocalStore {
  init(): Promise<void>
  putRow(tbl: DomainTable, id: string, payload: Record<string, unknown>): Promise<void>
  getRows(tbl: DomainTable): Promise<LocalRow[]>
  getUnsyncedRows(): Promise<LocalRow[]>
  isRowSynced(tbl: DomainTable, id: string): Promise<boolean>
  /** Con `rev`: solo marca synced si la fila local sigue en esa rev (no pisa un putRow concurrente). */
  markRowSynced(tbl: DomainTable, id: string, rev?: number): Promise<void>
  markRowFailed(tbl: DomainTable, id: string, error: string): Promise<void>
  deleteRow(tbl: DomainTable, id: string): Promise<void>
  /** Borra metadatos Y binarios de todas las fotos locales de un evento (tolera archivos ausentes). */
  deletePhotosByEvent(event_type: string, event_id: string): Promise<void>
  putPhoto(photo: NewLocalPhoto, blob: Blob): Promise<void>
  getPhotos(): Promise<LocalPhoto[]>
  getUnsyncedPhotos(): Promise<LocalPhoto[]>
  getPhotoBlob(photo_id: string): Promise<Blob | null>
  markPhotoSynced(photo_id: string): Promise<void>  // además borra el binario local
  markPhotoFailed(photo_id: string, error: string): Promise<void>
  pendingCounts(): Promise<PendingCounts>
  getMeta(key: string): Promise<string | null>
  setMeta(key: string, value: string): Promise<void>
}

const ORDER_INDEX = new Map<string, number>(SYNC_ORDER.map((t, i) => [t, i]))

/** Padres antes que hijos; dentro de la misma tabla, cronológico. */
export function sortBySyncOrder(rows: LocalRow[]): LocalRow[] {
  return [...rows].sort((a, b) => {
    const d = (ORDER_INDEX.get(a.tbl) ?? 99) - (ORDER_INDEX.get(b.tbl) ?? 99)
    return d !== 0 ? d : a.created_at.localeCompare(b.created_at)
  })
}
