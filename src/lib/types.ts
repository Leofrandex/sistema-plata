// ─── Enums ────────────────────────────────────────────────────────────────────

export type WasteType =
  | 'infectious'          // 1 — Peligroso infeccioso (treated on-site)
  | 'anatomopathological' // 2 — Anatomopatológico (external transfer)
  | 'cytotoxic'           // 3 — Citotóxico (external transfer)
  | 'liquid'              // 4 — Líquidos (external transfer)
  | 'morgue'              // 5 — Morgue (external transfer)

export type ContainerSize = 240 | 750 | 1100

export type ContainerStatus = 'active' | 'decommissioned'

export type LocationType =
  | 'client_site'
  | 'plant_storage'
  | 'cold_storage'
  | 'treatment'

export type PhotoEventType =
  | 'route'        // recorrido en punto de encuentro (antes 'exchange')
  | 'weighing'
  | 'storage'
  | 'treatment'
  | 'other'

// Phase of the container in its current lifecycle
export type ContainerPhase =
  | 'route'        // delivered clean / collected dirty — in transit to plant (antes 'exchange')
  | 'weighing'     // weighed at plant, waiting for cold storage
  | 'cold_storage' // in cold storage room
  | 'treatment'    // type 1: being treated on-site
  | 'transfer'     // types 2–5: stored temporarily / transferred to external center
  | 'clean'        // cycle complete, available for redeployment

// Horario fijo de los 6 recorridos por día
export type RouteSlot = '06:30' | '10:30' | '13:20' | '14:30' | '18:30' | '21:00'

// Tipo de recorrido. 'anden' usa los 6 slots fijos; 'morgue' es ad-hoc sin horario.
export type RouteKind = 'anden' | 'morgue'

export type RouteEventStatus = 'in_progress' | 'completed'
export type WeighingSessionStatus = 'in_progress' | 'completed'

// ─── Entities ─────────────────────────────────────────────────────────────────

export interface ClientLocation {
  floor: string
  area: string
}

export interface Client {
  id: string
  name: string             // ej: 'Centro de la Salud'
  locations: ClientLocation[]
}

// Empresa operativa dentro de un Cliente. Los envases pertenecen a Empresa.
export interface Company {
  id: string
  client_id: string        // FK → Client
  name: string             // 'ION', 'Airkem'
  code_letter: string      // 'I', 'A' — prefijo de envases
}

export interface Container {
  id: string             // '{company.code_letter}-NNN' → 'I-001', 'A-007'
  company_id: string     // FK → Company
  size_liters: ContainerSize
  tare_weight_kg: number
  waste_type: WasteType
  status: ContainerStatus
  registered_at: string  // ISO 8601 datetime
}

export interface Photo {
  id: string
  url: string
  event_type: PhotoEventType
  event_id: string
  taken_at: string       // ISO 8601 datetime
  label: string          // ej: 'PTDP Centro Salud 01/03/2026 09:40 PM'
}

// Recorrido (antes ExchangeEvent). Para 'anden': un evento por (slot, día). Para 'morgue': ad-hoc, sin slot.
export interface RouteEvent {
  id: string
  client_id: string             // FK → Client (un recorrido es para un cliente)
  kind: RouteKind               // 'anden' | 'morgue'
  slot: RouteSlot | null        // requerido para anden, null para morgue
  date: string                  // ISO date 'YYYY-MM-DD' — junto con slot identifica el recorrido del día (solo anden)
  started_at: string            // ISO datetime — cuando se tocó "Iniciar recorrido"
  ended_at: string | null       // null mientras está en curso
  operator_id: string
  status: RouteEventStatus
  // Envases SUCIOS recogidos en el recorrido (van a pesaje en planta)
  containers_dirty_received: string[]
  // Envases LIMPIOS entregados al cliente durante el recorrido
  containers_clean_delivered: string[]
  // Ubicación del recorrido
  floor: string
  area: string
  dock: string                  // andén
  // Fotos ilimitadas
  photo_ids: string[]
}

// Sesión de pesaje. Agrupa N receptions creadas en el mismo "turno" de pesaje.
export interface WeighingSession {
  id: string
  client_id: string
  date: string                  // ISO date
  started_at: string            // ISO datetime
  ended_at: string | null
  operator_id: string
  status: WeighingSessionStatus
  reception_ids: string[]
}

export interface ContainerReception {
  id: string
  container_id: string
  weighing_session_id: string | null   // ahora puede pertenecer a una sesión
  arrived_at: string
  gross_weight_kg: number
  // net_weight_kg is computed: gross_weight_kg - container.tare_weight_kg
  operator_id: string
  photo_ids: string[]
  observations: string                  // texto libre del operador (e.g. "Yaris/Picanto sin tara"). Default ''.
}

export interface StorageEvent {
  id: string
  container_id: string
  entry_at: string
  exit_at: string | null
  operator_id: string
  photo_ids: string[]
}

export interface TreatmentRun {
  id: string
  container_id: string
  started_at: string
  completed_at: string | null
  operator_id: string
}

export interface ExternalTransfer {
  id: string
  container_id: string
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
