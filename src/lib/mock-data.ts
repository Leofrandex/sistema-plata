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

// 10 envases por empresa
export const MOCK_CONTAINERS: Container[] = [
  // ION (I-001..I-010)
  { id: 'I-001', company_id: 'company-ion', size_liters: 240, tare_weight_kg: 14.2, waste_type: 'infectious', status: 'active', registered_at: '2026-01-15T08:00:00Z' },
  { id: 'I-002', company_id: 'company-ion', size_liters: 240, tare_weight_kg: 14.5, waste_type: 'infectious', status: 'active', registered_at: '2026-01-15T08:00:00Z' },
  { id: 'I-003', company_id: 'company-ion', size_liters: 240, tare_weight_kg: 14.1, waste_type: 'infectious', status: 'active', registered_at: '2026-01-15T08:00:00Z' },
  { id: 'I-004', company_id: 'company-ion', size_liters: 750, tare_weight_kg: 38.1, waste_type: 'anatomopathological', status: 'active', registered_at: '2026-01-20T08:00:00Z' },
  { id: 'I-005', company_id: 'company-ion', size_liters: 240, tare_weight_kg: 13.9, waste_type: 'cytotoxic', status: 'active', registered_at: '2026-01-20T08:00:00Z' },
  { id: 'I-006', company_id: 'company-ion', size_liters: 1100, tare_weight_kg: 62.0, waste_type: 'infectious', status: 'active', registered_at: '2026-02-01T08:00:00Z' },
  { id: 'I-007', company_id: 'company-ion', size_liters: 240, tare_weight_kg: 14.3, waste_type: 'infectious', status: 'active', registered_at: '2026-02-10T08:00:00Z' },
  { id: 'I-008', company_id: 'company-ion', size_liters: 240, tare_weight_kg: 14.0, waste_type: 'liquid', status: 'active', registered_at: '2026-02-10T08:00:00Z' },
  { id: 'I-009', company_id: 'company-ion', size_liters: 750, tare_weight_kg: 37.8, waste_type: 'infectious', status: 'active', registered_at: '2026-03-01T08:00:00Z' },
  { id: 'I-010', company_id: 'company-ion', size_liters: 240, tare_weight_kg: 14.4, waste_type: 'morgue', status: 'active', registered_at: '2026-03-01T08:00:00Z' },
  // Airkem (A-001..A-010)
  { id: 'A-001', company_id: 'company-airkem', size_liters: 240, tare_weight_kg: 14.0, waste_type: 'infectious', status: 'active', registered_at: '2026-01-15T08:00:00Z' },
  { id: 'A-002', company_id: 'company-airkem', size_liters: 240, tare_weight_kg: 14.2, waste_type: 'infectious', status: 'active', registered_at: '2026-01-15T08:00:00Z' },
  { id: 'A-003', company_id: 'company-airkem', size_liters: 240, tare_weight_kg: 14.1, waste_type: 'infectious', status: 'active', registered_at: '2026-01-15T08:00:00Z' },
  { id: 'A-004', company_id: 'company-airkem', size_liters: 750, tare_weight_kg: 38.5, waste_type: 'anatomopathological', status: 'active', registered_at: '2026-01-20T08:00:00Z' },
  { id: 'A-005', company_id: 'company-airkem', size_liters: 240, tare_weight_kg: 13.8, waste_type: 'cytotoxic', status: 'active', registered_at: '2026-01-20T08:00:00Z' },
  { id: 'A-006', company_id: 'company-airkem', size_liters: 1100, tare_weight_kg: 61.5, waste_type: 'infectious', status: 'active', registered_at: '2026-02-01T08:00:00Z' },
  { id: 'A-007', company_id: 'company-airkem', size_liters: 240, tare_weight_kg: 14.3, waste_type: 'infectious', status: 'active', registered_at: '2026-02-10T08:00:00Z' },
  { id: 'A-008', company_id: 'company-airkem', size_liters: 240, tare_weight_kg: 14.0, waste_type: 'liquid', status: 'active', registered_at: '2026-02-10T08:00:00Z' },
  { id: 'A-009', company_id: 'company-airkem', size_liters: 750, tare_weight_kg: 37.9, waste_type: 'infectious', status: 'active', registered_at: '2026-03-01T08:00:00Z' },
  { id: 'A-010', company_id: 'company-airkem', size_liters: 240, tare_weight_kg: 14.5, waste_type: 'morgue', status: 'active', registered_at: '2026-03-01T08:00:00Z' },
]

// Hoy se completó la 1.ª y 2.ª ruta para Centro de la Salud.
// En cada recorrido se ENTREGAN envases limpios y se RECOGEN sucios.
export const MOCK_ROUTE_EVENTS: RouteEvent[] = [
  {
    id: 'route-1',
    client_id: 'client-1',
    slot: '06:30',
    date: '2026-05-17',
    started_at: '2026-05-17T06:30:00-05:00',
    ended_at: '2026-05-17T08:12:00-05:00',
    operator_id: 'user-1',
    status: 'completed',
    containers_dirty_received: ['I-001', 'I-002', 'A-001', 'A-002'],
    containers_clean_delivered: ['I-007', 'I-008', 'A-007', 'A-008'],
    floor: '1',
    area: 'Emergencias',
    dock: 'Andén Norte',
    photo_ids: ['photo-r1-1', 'photo-r1-2', 'photo-r1-3'],
  },
  {
    id: 'route-2',
    client_id: 'client-1',
    slot: '10:30',
    date: '2026-05-17',
    started_at: '2026-05-17T10:30:00-05:00',
    ended_at: '2026-05-17T11:45:00-05:00',
    operator_id: 'user-2',
    status: 'completed',
    containers_dirty_received: ['I-003', 'A-003', 'A-004'],
    containers_clean_delivered: ['I-009', 'A-009'],
    floor: '2',
    area: 'Pediatría',
    dock: 'Andén Sur',
    photo_ids: ['photo-r2-1', 'photo-r2-2'],
  },
]

export const MOCK_WEIGHING_SESSIONS: WeighingSession[] = [
  {
    id: 'weighing-1',
    client_id: 'client-1',
    date: '2026-05-17',
    started_at: '2026-05-17T09:00:00-05:00',
    ended_at: '2026-05-17T09:45:00-05:00',
    operator_id: 'user-1',
    status: 'completed',
    reception_ids: ['reception-1', 'reception-2'],
  },
]

export const MOCK_RECEPTIONS: ContainerReception[] = [
  {
    id: 'reception-1',
    container_id: 'I-001',
    weighing_session_id: 'weighing-1',
    arrived_at: '2026-05-17T09:15:00-05:00',
    gross_weight_kg: 43.7,
    operator_id: 'user-1',
    photo_ids: ['photo-w1-1', 'photo-w1-2'],
  },
  {
    id: 'reception-2',
    container_id: 'I-002',
    weighing_session_id: 'weighing-1',
    arrived_at: '2026-05-17T09:20:00-05:00',
    gross_weight_kg: 38.2,
    operator_id: 'user-1',
    photo_ids: ['photo-w2-1', 'photo-w2-2'],
  },
]

export const MOCK_STORAGE_EVENTS: StorageEvent[] = [
  {
    id: 'storage-1',
    container_id: 'I-001',
    entry_at: '2026-05-17T09:45:00-05:00',
    exit_at: null,
    operator_id: 'user-1',
    photo_ids: [],
  },
  {
    id: 'storage-2',
    container_id: 'I-002',
    entry_at: '2026-05-17T09:45:00-05:00',
    exit_at: null,
    operator_id: 'user-1',
    photo_ids: [],
  },
]

export const MOCK_TREATMENT_RUNS: TreatmentRun[] = []

export const MOCK_EXTERNAL_TRANSFERS: ExternalTransfer[] = []

export const MOCK_LOCATIONS: ContainerLocation[] = [
  {
    id: 'loc-1',
    container_id: 'I-001',
    reported_at: '2026-05-17T06:30:00-05:00',
    operator_id: 'user-1',
    location_type: 'client_site',
    client_id: 'client-1',
    floor: '1',
    area: 'Emergencias',
    notes: null,
  },
  {
    id: 'loc-2',
    container_id: 'I-001',
    reported_at: '2026-05-17T09:45:00-05:00',
    operator_id: 'user-1',
    location_type: 'cold_storage',
    client_id: null,
    floor: null,
    area: null,
    notes: 'Cámara fría',
  },
]

export const MOCK_PHOTOS: Photo[] = [
  // Recorridos
  { id: 'photo-r1-1', url: 'https://placehold.co/400x300?text=Recorrido+1', event_type: 'route', event_id: 'route-1', taken_at: '2026-05-17T07:00:00-05:00', label: 'PTDP Centro Salud 17/05/2026 07:00 AM' },
  { id: 'photo-r1-2', url: 'https://placehold.co/400x300?text=Recorrido+2', event_type: 'route', event_id: 'route-1', taken_at: '2026-05-17T07:15:00-05:00', label: 'PTDP Centro Salud 17/05/2026 07:15 AM' },
  { id: 'photo-r1-3', url: 'https://placehold.co/400x300?text=Recorrido+3', event_type: 'route', event_id: 'route-1', taken_at: '2026-05-17T07:30:00-05:00', label: 'PTDP Centro Salud 17/05/2026 07:30 AM' },
  { id: 'photo-r2-1', url: 'https://placehold.co/400x300?text=Recorrido+4', event_type: 'route', event_id: 'route-2', taken_at: '2026-05-17T11:00:00-05:00', label: 'PTDP Centro Salud 17/05/2026 11:00 AM' },
  { id: 'photo-r2-2', url: 'https://placehold.co/400x300?text=Recorrido+5', event_type: 'route', event_id: 'route-2', taken_at: '2026-05-17T11:15:00-05:00', label: 'PTDP Centro Salud 17/05/2026 11:15 AM' },
  // Pesajes
  { id: 'photo-w1-1', url: 'https://placehold.co/400x300?text=Envase+I-001', event_type: 'weighing', event_id: 'reception-1', taken_at: '2026-05-17T09:15:00-05:00', label: 'PTDP Centro Salud 17/05/2026 09:15 AM' },
  { id: 'photo-w1-2', url: 'https://placehold.co/400x300?text=Balanza+43.7kg', event_type: 'weighing', event_id: 'reception-1', taken_at: '2026-05-17T09:16:00-05:00', label: 'PTDP Centro Salud 17/05/2026 09:16 AM' },
  { id: 'photo-w2-1', url: 'https://placehold.co/400x300?text=Envase+I-002', event_type: 'weighing', event_id: 'reception-2', taken_at: '2026-05-17T09:20:00-05:00', label: 'PTDP Centro Salud 17/05/2026 09:20 AM' },
  { id: 'photo-w2-2', url: 'https://placehold.co/400x300?text=Balanza+38.2kg', event_type: 'weighing', event_id: 'reception-2', taken_at: '2026-05-17T09:21:00-05:00', label: 'PTDP Centro Salud 17/05/2026 09:21 AM' },
]
