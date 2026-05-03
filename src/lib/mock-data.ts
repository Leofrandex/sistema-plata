import type {
  Client,
  Container,
  Batch,
  ExchangeEvent,
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
    name: 'Ciudad de la Salud',
    code_letter: 'A',
    locations: [
      { floor: '1', area: 'Emergencias' },
      { floor: '2', area: 'Pediatría' },
      { floor: '3', area: 'UCI' },
    ],
  },
  {
    id: 'client-2',
    name: 'Agua Dulce',
    code_letter: 'B',
    locations: [
      { floor: '1', area: 'Consulta Externa' },
      { floor: '2', area: 'Cirugía' },
    ],
  },
  {
    id: 'client-3',
    name: 'Hospital Santo Tomás',
    code_letter: 'C',
    locations: [
      { floor: '1', area: 'Urgencias' },
      { floor: '4', area: 'Oncología' },
    ],
  },
]

export const MOCK_CONTAINERS: Container[] = [
  // Client A — Ciudad de la Salud
  { id: 'A-001', client_id: 'client-1', size_liters: 240, tare_weight_kg: 14.2, waste_type: 'infectious', status: 'active', registered_at: '2026-01-15T08:00:00Z' },
  { id: 'A-002', client_id: 'client-1', size_liters: 240, tare_weight_kg: 14.5, waste_type: 'infectious', status: 'active', registered_at: '2026-01-15T08:00:00Z' },
  { id: 'A-003', client_id: 'client-1', size_liters: 750, tare_weight_kg: 38.1, waste_type: 'anatomopathological', status: 'active', registered_at: '2026-01-15T08:00:00Z' },
  { id: 'A-004', client_id: 'client-1', size_liters: 240, tare_weight_kg: 13.9, waste_type: 'cytotoxic', status: 'active', registered_at: '2026-01-20T08:00:00Z' },
  { id: 'A-005', client_id: 'client-1', size_liters: 1100, tare_weight_kg: 62.0, waste_type: 'infectious', status: 'active', registered_at: '2026-02-01T08:00:00Z' },
  // Client B — Agua Dulce
  { id: 'B-001', client_id: 'client-2', size_liters: 240, tare_weight_kg: 14.1, waste_type: 'infectious', status: 'active', registered_at: '2026-01-20T08:00:00Z' },
  { id: 'B-002', client_id: 'client-2', size_liters: 240, tare_weight_kg: 14.3, waste_type: 'morgue', status: 'active', registered_at: '2026-01-20T08:00:00Z' },
  // Client C — Santo Tomás
  { id: 'C-001', client_id: 'client-3', size_liters: 750, tare_weight_kg: 37.8, waste_type: 'infectious', status: 'active', registered_at: '2026-02-10T08:00:00Z' },
  { id: 'C-002', client_id: 'client-3', size_liters: 240, tare_weight_kg: 14.0, waste_type: 'liquid', status: 'active', registered_at: '2026-02-10T08:00:00Z' },
]

export const MOCK_BATCHES: Batch[] = [
  // Active batch — client 1
  { id: 'batch-1', client_id: 'client-1', date: '2026-05-03', status: 'active', container_ids: ['A-001', 'A-002', 'A-003', 'A-004', 'A-005'] },
  // Active batch — client 2
  { id: 'batch-2', client_id: 'client-2', date: '2026-05-03', status: 'active', container_ids: ['B-001', 'B-002'] },
  // Completed batch — client 1 (yesterday)
  { id: 'batch-3', client_id: 'client-1', date: '2026-05-02', status: 'completed', container_ids: ['A-001', 'A-002'] },
  // Completed batch — client 3
  { id: 'batch-4', client_id: 'client-3', date: '2026-04-30', status: 'completed', container_ids: ['C-001', 'C-002'] },
]

export const MOCK_EXCHANGE_EVENTS: ExchangeEvent[] = [
  {
    id: 'exchange-1',
    batch_id: 'batch-1',
    timestamp: '2026-05-03T07:30:00Z',
    operator_id: 'user-1',
    clean_containers_given: ['A-001', 'A-002'],
    dirty_containers_received: ['A-001', 'A-002'],
    location: 'Puerta de Emergencias, piso 1',
    photo_ids: ['photo-1', 'photo-2'],
  },
]

export const MOCK_RECEPTIONS: ContainerReception[] = [
  {
    id: 'reception-1',
    container_id: 'A-001',
    batch_id: 'batch-1',
    arrived_at: '2026-05-03T09:15:00Z',
    gross_weight_kg: 43.7,
    operator_id: 'user-1',
    photo_ids: ['photo-3', 'photo-4'],
  },
  {
    id: 'reception-2',
    container_id: 'A-002',
    batch_id: 'batch-1',
    arrived_at: '2026-05-03T09:20:00Z',
    gross_weight_kg: 38.2,
    operator_id: 'user-1',
    photo_ids: ['photo-5', 'photo-6'],
  },
]

export const MOCK_STORAGE_EVENTS: StorageEvent[] = [
  {
    id: 'storage-1',
    container_id: 'A-001',
    batch_id: 'batch-1',
    entry_at: '2026-05-03T10:00:00Z',
    exit_at: null,
    operator_id: 'user-2',
    photo_ids: ['photo-7'],
  },
]

export const MOCK_TREATMENT_RUNS: TreatmentRun[] = []

export const MOCK_EXTERNAL_TRANSFERS: ExternalTransfer[] = []

export const MOCK_LOCATIONS: ContainerLocation[] = [
  {
    id: 'loc-1',
    container_id: 'A-001',
    reported_at: '2026-05-03T07:30:00Z',
    operator_id: 'user-1',
    location_type: 'client_site',
    client_id: 'client-1',
    floor: '2',
    area: 'Pediatría',
    notes: null,
  },
  {
    id: 'loc-2',
    container_id: 'A-001',
    reported_at: '2026-05-03T09:15:00Z',
    operator_id: 'user-1',
    location_type: 'plant_storage',
    client_id: null,
    floor: null,
    area: null,
    notes: 'Llegó a planta para pesaje',
  },
]

export const MOCK_PHOTOS: Photo[] = [
  { id: 'photo-1', url: 'https://placehold.co/400x300?text=Exchange+Clean', event_type: 'exchange', event_id: 'exchange-1', taken_at: '2026-05-03T07:30:00Z', label: 'PTDP Ciudad Salud 03/05/2026 07:30 AM' },
  { id: 'photo-2', url: 'https://placehold.co/400x300?text=Exchange+Dirty', event_type: 'exchange', event_id: 'exchange-1', taken_at: '2026-05-03T07:32:00Z', label: 'PTDP Ciudad Salud 03/05/2026 07:32 AM' },
  { id: 'photo-3', url: 'https://placehold.co/400x300?text=Container+A-001', event_type: 'weighing', event_id: 'reception-1', taken_at: '2026-05-03T09:15:00Z', label: 'PTDP Ciudad Salud 03/05/2026 09:15 AM' },
  { id: 'photo-4', url: 'https://placehold.co/400x300?text=Scale+43.7kg', event_type: 'weighing', event_id: 'reception-1', taken_at: '2026-05-03T09:16:00Z', label: 'PTDP Ciudad Salud 03/05/2026 09:16 AM' },
  { id: 'photo-5', url: 'https://placehold.co/400x300?text=Container+A-002', event_type: 'weighing', event_id: 'reception-2', taken_at: '2026-05-03T09:20:00Z', label: 'PTDP Ciudad Salud 03/05/2026 09:20 AM' },
  { id: 'photo-6', url: 'https://placehold.co/400x300?text=Scale+38.2kg', event_type: 'weighing', event_id: 'reception-2', taken_at: '2026-05-03T09:21:00Z', label: 'PTDP Ciudad Salud 03/05/2026 09:21 AM' },
  { id: 'photo-7', url: 'https://placehold.co/400x300?text=Cold+Storage', event_type: 'storage', event_id: 'storage-1', taken_at: '2026-05-03T10:00:00Z', label: 'PTDP Ciudad Salud 03/05/2026 10:00 AM' },
]
