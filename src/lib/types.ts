// ─── Enums ────────────────────────────────────────────────────────────────────

export type WasteType =
  | 'infectious'          // 1 — Peligroso infeccioso (treated on-site)
  | 'anatomopathological' // 2 — Anatomopatológico (external transfer)
  | 'cytotoxic'           // 3 — Citotóxico (external transfer)
  | 'liquid'              // 4 — Líquidos (external transfer)
  | 'morgue'              // 5 — Morgue (external transfer)

export type ContainerSize = 240 | 750 | 1100

export type ContainerStatus = 'active' | 'decommissioned'

export type BatchStatus = 'active' | 'completed'

export type LocationType =
  | 'client_site'
  | 'plant_storage'
  | 'cold_storage'
  | 'treatment'

export type PhotoEventType =
  | 'exchange'
  | 'weighing'
  | 'storage'
  | 'treatment'
  | 'other'

// Phase of the container in its current lifecycle
export type ContainerPhase =
  | 'exchange'     // delivered clean / collected dirty — in transit to plant
  | 'weighing'     // weighed at plant, waiting for cold storage
  | 'cold_storage' // in cold storage room
  | 'treatment'    // type 1: being treated on-site
  | 'transfer'     // types 2–5: stored temporarily / transferred to external center
  | 'clean'        // cycle complete, available for redeployment

// ─── Entities ─────────────────────────────────────────────────────────────────

export interface ClientLocation {
  floor: string
  area: string
}

export interface Client {
  id: string
  name: string
  code_letter: string // single uppercase letter, prefix for container IDs
  locations: ClientLocation[]
}

export interface Container {
  id: string             // format: '{letter}-{number}', e.g. 'A-069'
  client_id: string
  size_liters: ContainerSize
  tare_weight_kg: number
  waste_type: WasteType
  status: ContainerStatus
  registered_at: string  // ISO 8601 datetime
}

export interface Batch {
  id: string
  client_id: string
  date: string           // ISO 8601 date, e.g. '2026-05-03'
  status: BatchStatus
  container_ids: string[]
}

export interface Photo {
  id: string
  url: string
  event_type: PhotoEventType
  event_id: string
  taken_at: string       // ISO 8601 datetime
  label: string          // e.g. 'PTDP Ciudad Salud 01/03/2026 09:40 PM'
}

export interface ExchangeEvent {
  id: string
  batch_id: string
  timestamp: string
  operator_id: string
  clean_containers_given: string[]    // container IDs
  dirty_containers_received: string[] // container IDs
  location: string
  photo_ids: string[]
}

export interface ContainerReception {
  id: string
  container_id: string
  batch_id: string
  arrived_at: string
  gross_weight_kg: number
  // net_weight_kg is computed: gross_weight_kg - container.tare_weight_kg
  operator_id: string
  photo_ids: string[]
}

export interface StorageEvent {
  id: string
  container_id: string
  batch_id: string
  entry_at: string
  exit_at: string | null
  operator_id: string
  photo_ids: string[]
}

export interface TreatmentRun {
  id: string
  container_id: string
  batch_id: string
  started_at: string
  completed_at: string | null
  operator_id: string
}

export interface ExternalTransfer {
  id: string
  container_id: string
  batch_id: string
  storage_started_at: string
  transferred_at: string | null
  destination: string
  operator_id: string
}

export interface ContainerLocation {
  id: string
  container_id: string
  reported_at: string
  operator_id: string
  location_type: LocationType
  client_id: string | null
  floor: string | null
  area: string | null
  notes: string | null
}

export interface User {
  id: string
  name: string
}

// ─── Derived / view types ─────────────────────────────────────────────────────

export interface ContainerWithPhase extends Container {
  current_phase: ContainerPhase
  current_location: ContainerLocation | null
  latest_net_weight_kg: number | null
}

export interface BatchWithClient extends Batch {
  client: Client
  next_pending_step: ContainerPhase // earliest phase with incomplete containers
  container_count: number
}
