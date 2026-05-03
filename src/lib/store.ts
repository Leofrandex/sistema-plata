import { create } from 'zustand'
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
import {
  MOCK_CLIENTS,
  MOCK_CONTAINERS,
  MOCK_BATCHES,
  MOCK_EXCHANGE_EVENTS,
  MOCK_RECEPTIONS,
  MOCK_STORAGE_EVENTS,
  MOCK_TREATMENT_RUNS,
  MOCK_EXTERNAL_TRANSFERS,
  MOCK_LOCATIONS,
  MOCK_USERS,
  MOCK_PHOTOS,
} from './mock-data'

interface HospimedStore {
  clients: Client[]
  containers: Container[]
  batches: Batch[]
  exchangeEvents: ExchangeEvent[]
  receptions: ContainerReception[]
  storageEvents: StorageEvent[]
  treatmentRuns: TreatmentRun[]
  externalTransfers: ExternalTransfer[]
  locations: ContainerLocation[]
  users: User[]
  photos: Photo[]

  // Mutations (used by registration flows in Plan 3)
  addReception: (reception: ContainerReception) => void
  addStorageEvent: (event: StorageEvent) => void
  addTreatmentRun: (run: TreatmentRun) => void
  addExternalTransfer: (transfer: ExternalTransfer) => void
  addLocation: (location: ContainerLocation) => void
  addExchangeEvent: (event: ExchangeEvent) => void
  addContainer: (container: Container) => void
  updateContainer: (id: string, updates: Partial<Container>) => void
  addClient: (client: Client) => void
  updateClient: (id: string, updates: Partial<Client>) => void
  updateBatch: (id: string, updates: Partial<Batch>) => void
  addBatch: (batch: Batch) => void
  addPhoto: (photo: Photo) => void
}

export const useStore = create<HospimedStore>((set) => ({
  clients: MOCK_CLIENTS,
  containers: MOCK_CONTAINERS,
  batches: MOCK_BATCHES,
  exchangeEvents: MOCK_EXCHANGE_EVENTS,
  receptions: MOCK_RECEPTIONS,
  storageEvents: MOCK_STORAGE_EVENTS,
  treatmentRuns: MOCK_TREATMENT_RUNS,
  externalTransfers: MOCK_EXTERNAL_TRANSFERS,
  locations: MOCK_LOCATIONS,
  users: MOCK_USERS,
  photos: MOCK_PHOTOS,

  addReception: (reception) =>
    set((s) => ({ receptions: [...s.receptions, reception] })),

  addStorageEvent: (event) =>
    set((s) => ({ storageEvents: [...s.storageEvents, event] })),

  addTreatmentRun: (run) =>
    set((s) => ({ treatmentRuns: [...s.treatmentRuns, run] })),

  addExternalTransfer: (transfer) =>
    set((s) => ({ externalTransfers: [...s.externalTransfers, transfer] })),

  addLocation: (location) =>
    set((s) => ({ locations: [...s.locations, location] })),

  addExchangeEvent: (event) =>
    set((s) => ({ exchangeEvents: [...s.exchangeEvents, event] })),

  addContainer: (container) =>
    set((s) => ({ containers: [...s.containers, container] })),

  updateContainer: (id, updates) =>
    set((s) => ({
      containers: s.containers.map((c) => (c.id === id ? { ...c, ...updates } : c)),
    })),

  addClient: (client) =>
    set((s) => ({ clients: [...s.clients, client] })),

  updateClient: (id, updates) =>
    set((s) => ({
      clients: s.clients.map((c) => (c.id === id ? { ...c, ...updates } : c)),
    })),

  updateBatch: (id, updates) =>
    set((s) => ({
      batches: s.batches.map((b) => (b.id === id ? { ...b, ...updates } : b)),
    })),

  addBatch: (batch) =>
    set((s) => ({ batches: [...s.batches, batch] })),

  addPhoto: (photo) =>
    set((s) => ({ photos: [...s.photos, photo] })),
}))
