import { create } from 'zustand'
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
  UserRole,
} from './types'
import {
  MOCK_CLIENTS,
  MOCK_COMPANIES,
  MOCK_CONTAINERS,
  MOCK_ROUTE_EVENTS,
  MOCK_WEIGHING_SESSIONS,
  MOCK_RECEPTIONS,
  MOCK_STORAGE_EVENTS,
  MOCK_TREATMENT_RUNS,
  MOCK_EXTERNAL_TRANSFERS,
  MOCK_LOCATIONS,
  MOCK_USERS,
  MOCK_PHOTOS,
} from './mock-data'

interface HospiwasteStore {
  clients: Client[]
  companies: Company[]
  containers: Container[]
  routeEvents: RouteEvent[]
  weighingSessions: WeighingSession[]
  receptions: ContainerReception[]
  storageEvents: StorageEvent[]
  treatmentRuns: TreatmentRun[]
  externalTransfers: ExternalTransfer[]
  locations: ContainerLocation[]
  users: User[]
  photos: Photo[]

  /** uuid del operador autenticado (auth.users.id). Null antes de hidratar. */
  currentProfileId: string | null
  setCurrentProfileId: (id: string | null) => void

  /** Rol del usuario autenticado. Null antes de hidratar. */
  currentRole: UserRole | null
  setCurrentRole: (role: UserRole | null) => void

  /**
   * Estado de la conexión con Supabase para la hidratación de datos.
   * - 'connecting': intento en curso (aún no hubo éxito).
   * - 'online': la última hidratación fue exitosa → datos reales.
   * - 'error': la última hidratación falló → la UI puede estar mostrando mocks.
   */
  connectionStatus: 'connecting' | 'online' | 'error'
  setConnectionStatus: (status: 'connecting' | 'online' | 'error') => void

  /**
   * Reemplaza N campos del store de una vez (post-hidratación desde Supabase).
   * Las claves no pasadas no se modifican.
   */
  hydrate: (patch: Partial<Omit<HospiwasteStore, 'hydrate' | 'setCurrentProfileId' | 'setCurrentRole'>>) => void

  // Clientes / empresas
  addClient: (client: Client) => void
  updateClient: (id: string, updates: Partial<Client>) => void
  addCompany: (company: Company) => void
  updateCompany: (id: string, updates: Partial<Company>) => void

  // Tachos
  addContainer: (container: Container) => void
  updateContainer: (id: string, updates: Partial<Container>) => void

  // Recorridos
  addRouteEvent: (event: RouteEvent) => void
  updateRouteEvent: (id: string, updates: Partial<RouteEvent>) => void
  deleteRouteEvent: (id: string) => void

  // Sesiones de pesaje y receptions
  addWeighingSession: (session: WeighingSession) => void
  updateWeighingSession: (id: string, updates: Partial<WeighingSession>) => void
  /** Borra una sesión y todas sus receptions y fotos asociadas. */
  deleteWeighingSession: (id: string) => void
  addReception: (reception: ContainerReception) => void
  updateReception: (id: string, updates: Partial<ContainerReception>) => void

  // Eventos posteriores
  addStorageEvent: (event: StorageEvent) => void
  addTreatmentRun: (run: TreatmentRun) => void
  addExternalTransfer: (transfer: ExternalTransfer) => void
  addLocation: (location: ContainerLocation) => void
  addPhoto: (photo: Photo) => void
}

export const useStore = create<HospiwasteStore>((set) => ({
  clients: MOCK_CLIENTS,
  companies: MOCK_COMPANIES,
  containers: MOCK_CONTAINERS,
  routeEvents: MOCK_ROUTE_EVENTS,
  weighingSessions: MOCK_WEIGHING_SESSIONS,
  receptions: MOCK_RECEPTIONS,
  storageEvents: MOCK_STORAGE_EVENTS,
  treatmentRuns: MOCK_TREATMENT_RUNS,
  externalTransfers: MOCK_EXTERNAL_TRANSFERS,
  locations: MOCK_LOCATIONS,
  users: MOCK_USERS,
  photos: MOCK_PHOTOS,

  currentProfileId: null,
  setCurrentProfileId: (id) => set({ currentProfileId: id }),

  currentRole: null,
  setCurrentRole: (role) => set({ currentRole: role }),

  connectionStatus: 'connecting',
  setConnectionStatus: (status) => set({ connectionStatus: status }),

  hydrate: (patch) => set(patch),

  addClient: (client) =>
    set((s) => ({ clients: [...s.clients, client] })),

  updateClient: (id, updates) =>
    set((s) => ({
      clients: s.clients.map((c) => (c.id === id ? { ...c, ...updates } : c)),
    })),

  addCompany: (company) =>
    set((s) => ({ companies: [...s.companies, company] })),

  updateCompany: (id, updates) =>
    set((s) => ({
      companies: s.companies.map((c) => (c.id === id ? { ...c, ...updates } : c)),
    })),

  addContainer: (container) =>
    set((s) => ({ containers: [...s.containers, container] })),

  updateContainer: (id, updates) =>
    set((s) => ({
      containers: s.containers.map((c) => (c.id === id ? { ...c, ...updates } : c)),
    })),

  addRouteEvent: (event) =>
    set((s) => ({ routeEvents: [...s.routeEvents, event] })),

  updateRouteEvent: (id, updates) =>
    set((s) => ({
      routeEvents: s.routeEvents.map((r) => (r.id === id ? { ...r, ...updates } : r)),
    })),

  deleteRouteEvent: (id) =>
    set((s) => {
      const event = s.routeEvents.find((r) => r.id === id)
      if (!event) return s
      const photoIds = new Set(event.photo_ids)
      return {
        routeEvents: s.routeEvents.filter((r) => r.id !== id),
        photos: s.photos.filter((p) => !photoIds.has(p.id)),
      }
    }),

  addWeighingSession: (session) =>
    set((s) => ({ weighingSessions: [...s.weighingSessions, session] })),

  updateWeighingSession: (id, updates) =>
    set((s) => ({
      weighingSessions: s.weighingSessions.map((w) =>
        w.id === id ? { ...w, ...updates } : w
      ),
    })),

  deleteWeighingSession: (id) =>
    set((s) => {
      const session = s.weighingSessions.find((w) => w.id === id)
      if (!session) return s
      const receptionIds = new Set(session.reception_ids)
      const receptions = s.receptions.filter((r) => !receptionIds.has(r.id))
      const droppedPhotoIds = new Set(
        s.receptions
          .filter((r) => receptionIds.has(r.id))
          .flatMap((r) => r.photo_ids),
      )
      return {
        weighingSessions: s.weighingSessions.filter((w) => w.id !== id),
        receptions,
        photos: s.photos.filter((p) => !droppedPhotoIds.has(p.id)),
      }
    }),

  addReception: (reception) =>
    set((s) => ({ receptions: [...s.receptions, reception] })),

  updateReception: (id, updates) =>
    set((s) => ({
      receptions: s.receptions.map((r) => (r.id === id ? { ...r, ...updates } : r)),
    })),

  addStorageEvent: (event) =>
    set((s) => ({ storageEvents: [...s.storageEvents, event] })),

  addTreatmentRun: (run) =>
    set((s) => ({ treatmentRuns: [...s.treatmentRuns, run] })),

  addExternalTransfer: (transfer) =>
    set((s) => ({ externalTransfers: [...s.externalTransfers, transfer] })),

  addLocation: (location) =>
    set((s) => ({ locations: [...s.locations, location] })),

  addPhoto: (photo) =>
    set((s) => ({ photos: [...s.photos, photo] })),
}))
