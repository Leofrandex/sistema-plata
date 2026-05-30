import type {
  Client,
  Company,
  Container,
  RouteEvent,
  WeighingSession,
  ContainerReception,
  StorageEvent,
  TreatmentRun,
  ExternalTransfer,
  ContainerLocation,
  User,
  Photo,
} from './types'
import historical from './data/historical-data.json'

// Data histórica de Airkem (2026-01-01 → 2026-05-11) extraída del Excel
// `vault/inbox/2026-05-17-historico-tachos.xlsx`. Generada por
// `scripts/extract-historical-data.py`. Reemplaza los 10 tachos Airkem
// hardcoded por los 189 reales y aporta ~14k recepciones para alimentar el
// dashboard ejecutivo con kg reales. ION queda fuera del histórico (no
// participaba en el periodo capturado).
const HISTORICAL_CONTAINERS = historical.containers as Container[]
const HISTORICAL_WEIGHING_SESSIONS = historical.weighing_sessions as WeighingSession[]
const HISTORICAL_RECEPTIONS: ContainerReception[] = (historical.receptions as Omit<ContainerReception, 'observations'>[]).map((r) => ({
  ...r,
  observations: '',
}))
const HISTORICAL_STORAGE_EVENTS = historical.storage_events as StorageEvent[]
const HISTORICAL_TREATMENT_RUNS = historical.treatment_runs as TreatmentRun[]
const HISTORICAL_LOCATIONS = historical.locations as ContainerLocation[]

export const MOCK_USERS: User[] = [
  { id: 'user-1', name: 'Carlos Méndez' },
  { id: 'user-2', name: 'Ana Torres' },
]

export const MOCK_CLIENTS: Client[] = [
  {
    id: 'client-1',
    name: 'Centro de la Salud',
    locations: [
      { floor: '1', area: 'Emergencias' },
      { floor: '2', area: 'Pediatría' },
      { floor: '3', area: 'UCI' },
      { floor: '4', area: 'Oncología' },
    ],
  },
]

export const MOCK_COMPANIES: Company[] = [
  { id: 'company-ion', client_id: 'client-1', name: 'ION', code_letter: 'I' },
  { id: 'company-airkem', client_id: 'client-1', name: 'Airkem', code_letter: 'A' },
]

// Pool real: 189 tachos Airkem del histórico Excel (2026-01-01 → 2026-05-11).
// Los 10 tachos ION de demo fueron eliminados; ION sigue siendo una empresa
// válida en MOCK_COMPANIES pero sin tachos hardcoded aquí.
export const MOCK_CONTAINERS: Container[] = [
  // Airkem (A-001..A-189) — provenientes del histórico
  ...HISTORICAL_CONTAINERS,
]

// Hoy se completó la 1.ª y 2.ª ruta para Centro de la Salud.
// En cada recorrido se ENTREGAN tachos limpios y se RECOGEN sucios.
export const MOCK_ROUTE_EVENTS: RouteEvent[] = [
  {
    id: 'route-1',
    client_id: 'client-1',
    kind: 'anden',
    slot: '06:30',
    date: '2026-05-17',
    started_at: '2026-05-17T06:30:00-05:00',
    ended_at: '2026-05-17T08:12:00-05:00',
    operator_id: 'user-1',
    status: 'completed',
    containers_dirty_received: ['A-001', 'A-002'],
    containers_clean_delivered: ['A-007', 'A-008'],
    floor: '1',
    area: 'Emergencias',
    dock: 'Andén Norte',
    photo_ids: ['photo-r1-1', 'photo-r1-2', 'photo-r1-3'],
  },
  {
    id: 'route-2',
    client_id: 'client-1',
    kind: 'anden',
    slot: '10:30',
    date: '2026-05-17',
    started_at: '2026-05-17T10:30:00-05:00',
    ended_at: '2026-05-17T11:45:00-05:00',
    operator_id: 'user-2',
    status: 'completed',
    containers_dirty_received: ['A-003', 'A-004'],
    containers_clean_delivered: ['A-009'],
    floor: '2',
    area: 'Pediatría',
    dock: 'Andén Sur',
    photo_ids: ['photo-r2-1', 'photo-r2-2'],
  },
]

export const MOCK_WEIGHING_SESSIONS: WeighingSession[] = [
  // Sesión histórica de la semana pasada (solo Airkem; ION quitado)
  {
    id: 'weighing-prev',
    client_id: 'client-1',
    date: '2026-05-10',
    started_at: '2026-05-10T09:00:00-05:00',
    ended_at: '2026-05-10T10:30:00-05:00',
    operator_id: 'user-1',
    status: 'completed',
    reception_ids: ['reception-prev-3', 'reception-prev-4'],
  },
  // Sesión de hoy (sin recepciones de tachos ION — se eliminaron los mocks ION)
  {
    id: 'weighing-1',
    client_id: 'client-1',
    date: '2026-05-17',
    started_at: '2026-05-17T09:00:00-05:00',
    ended_at: '2026-05-17T09:45:00-05:00',
    operator_id: 'user-1',
    status: 'completed',
    reception_ids: [],
  },
  // Sesiones históricas (una por día, 2026-01-01 → 2026-05-11)
  ...HISTORICAL_WEIGHING_SESSIONS,
]

export const MOCK_RECEPTIONS: ContainerReception[] = [
  // ── Semana pasada (ya tratados / completados) — solo Airkem ───────────────
  {
    id: 'reception-prev-3',
    container_id: 'A-002',
    weighing_session_id: 'weighing-prev',
    arrived_at: '2026-05-10T09:35:00-05:00',
    gross_weight_kg: 42.5,  // neto = 28.3
    operator_id: 'user-1',
    photo_ids: [],
    observations: '',
  },
  {
    id: 'reception-prev-4',
    container_id: 'A-006',
    weighing_session_id: 'weighing-prev',
    arrived_at: '2026-05-10T09:45:00-05:00',
    gross_weight_kg: 88.5,  // neto = 27
    operator_id: 'user-1',
    photo_ids: [],
    observations: '',
  },
  // Recepciones históricas (~14k filas, generadas desde el Excel)
  ...HISTORICAL_RECEPTIONS,
]

export const MOCK_STORAGE_EVENTS: StorageEvent[] = [
  // Semana pasada: entraron y ya salieron (tratados) — solo Airkem
  { id: 'storage-prev-3', container_id: 'A-002', entry_at: '2026-05-10T10:30:00-05:00', exit_at: '2026-05-11T09:00:00-05:00', operator_id: 'user-1', photo_ids: [] },
  { id: 'storage-prev-4', container_id: 'A-006', entry_at: '2026-05-10T10:30:00-05:00', exit_at: '2026-05-11T10:00:00-05:00', operator_id: 'user-1', photo_ids: [] },
  // Storage events históricos (~14k, cerrados — entrada tras pesaje, salida al iniciar tratamiento)
  ...HISTORICAL_STORAGE_EVENTS,
]

export const MOCK_TREATMENT_RUNS: TreatmentRun[] = [
  // Airkem: tratamientos completados la semana pasada
  { id: 'treatment-prev-3', container_id: 'A-002', started_at: '2026-05-11T09:00:00-05:00', completed_at: '2026-05-11T10:30:00-05:00', operator_id: 'user-2' },
  { id: 'treatment-prev-4', container_id: 'A-006', started_at: '2026-05-11T10:00:00-05:00', completed_at: '2026-05-11T11:30:00-05:00', operator_id: 'user-2' },
  // Tratamientos históricos (~14k, completados)
  ...HISTORICAL_TREATMENT_RUNS,
]

export const MOCK_EXTERNAL_TRANSFERS: ExternalTransfer[] = []

export const MOCK_LOCATIONS: ContainerLocation[] = [
  // Ubicaciones históricas: tras el último tratamiento de cada container Airkem,
  // regresa limpio al cliente (evita que la torta los marque como "sin_registro")
  ...HISTORICAL_LOCATIONS,
]

export const MOCK_PHOTOS: Photo[] = [
  // Recorridos
  { id: 'photo-r1-1', url: 'https://placehold.co/400x300?text=Recorrido+1', event_type: 'route', event_id: 'route-1', taken_at: '2026-05-17T07:00:00-05:00', label: 'PTDP Centro Salud 17/05/2026 07:00 AM' },
  { id: 'photo-r1-2', url: 'https://placehold.co/400x300?text=Recorrido+2', event_type: 'route', event_id: 'route-1', taken_at: '2026-05-17T07:15:00-05:00', label: 'PTDP Centro Salud 17/05/2026 07:15 AM' },
  { id: 'photo-r1-3', url: 'https://placehold.co/400x300?text=Recorrido+3', event_type: 'route', event_id: 'route-1', taken_at: '2026-05-17T07:30:00-05:00', label: 'PTDP Centro Salud 17/05/2026 07:30 AM' },
  { id: 'photo-r2-1', url: 'https://placehold.co/400x300?text=Recorrido+4', event_type: 'route', event_id: 'route-2', taken_at: '2026-05-17T11:00:00-05:00', label: 'PTDP Centro Salud 17/05/2026 11:00 AM' },
  { id: 'photo-r2-2', url: 'https://placehold.co/400x300?text=Recorrido+5', event_type: 'route', event_id: 'route-2', taken_at: '2026-05-17T11:15:00-05:00', label: 'PTDP Centro Salud 17/05/2026 11:15 AM' },
]
