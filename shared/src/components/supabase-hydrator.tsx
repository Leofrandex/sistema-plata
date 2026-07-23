'use client'

import { useEffect } from 'react'
import { createClient } from '@hospiwaste/shared/lib/supabase/client'
import * as q from '@hospiwaste/shared/lib/supabase/queries'
import { useStore } from '@hospiwaste/shared/lib/store'
import { mergeById } from '@hospiwaste/shared/lib/data/hydrate-merge'
import { getLocalStore } from '@hospiwaste/shared/lib/local-store'
import { hydrateFromLocal, localPendingIds, type LocalSnapshot } from '@hospiwaste/shared/lib/local-store/hydrate-local'
import { migrateOutboxToLocalStore } from '@hospiwaste/shared/lib/local-store/migrate-outbox'
import type {
  Container,
  WeighingSession,
  ContainerReception,
  RouteEvent,
  Photo,
  StorageEvent,
  TreatmentRun,
  ExternalTransfer,
  ContainerLocation,
} from '@hospiwaste/shared/lib/types'

/**
 * Hidrata el store con datos de Supabase al montar y cada vez que cambia la
 * sesión auth. Mantiene la API del store intacta para que las pantallas que
 * todavía leen `useStore()` funcionen sin cambios.
 *
 * Para el piloto solo migramos el dominio de pesaje:
 *  - containers      ← Supabase
 *  - weighingSessions + receptions ← Supabase (computa reception_ids[] localmente)
 *  - routeEvents     ← Supabase (merge con join tables dirty/clean)
 *  - photos          ← Supabase Storage (URLs firmadas) + tabla public.photos
 *  - currentProfileId ← profile del usuario logueado
 *
 * Lo demás (clients, companies, storage…) sigue saliendo de los mocks
 * hasta que se migre en sesiones posteriores.
 */
export function SupabaseHydrator() {
  useEffect(() => {
    const supabase = createClient()

    let cancelled = false

    async function load() {
      // ID del operador desde la sesión LOCAL (sin red). Clave para offline:
      // `getCurrentProfile` usa `auth.getUser()`, que valida contra el servidor y
      // offline devuelve null → currentProfileId quedaba en null y el guardado de
      // andén/pesaje se bloqueaba (`if (!currentProfileId) return`). `getSession()`
      // lee el id del JWT guardado, sin red, así el id existe offline.
      const { data: sessionData } = await supabase.auth.getSession()
      const localUserId = sessionData.session?.user.id ?? null
      if (cancelled) return
      if (localUserId) useStore.getState().setCurrentProfileId(localUserId)

      // Hidratación local-first: SIEMPRE antes de tocar la red, para que un
      // reinicio de la app offline muestre los registros del dispositivo en
      // vez de los mocks iniciales. En hub el LocalStore (IndexedDB) queda
      // vacío porque hub no escribe ahí — el snapshot local es un no-op.
      // `migrateOutboxToLocalStore` es idempotente (flag en meta) y barata
      // en hub por la misma razón.
      const localStore = await getLocalStore()
      try {
        await migrateOutboxToLocalStore(localStore)
        hydrateLocalIntoStore(await hydrateFromLocal(localStore))
      } catch (err) {
        // Un fallo leyendo el LocalStore nunca debe tumbar la hidratación:
        // seguimos con lo que ya hubiera en el store (mocks o corrida previa).
        // eslint-disable-next-line no-console
        console.error('[SupabaseHydrator] local hydration failed:', err)
      }
      if (cancelled) return

      try {
        // Profile del usuario actual (puede ser null si no hay sesión o si estamos
        // offline). Solo pisa id/rol cuando trae algo; offline conserva lo local.
        const profile = await q.getCurrentProfile(supabase)
        if (cancelled) return
        if (profile) {
          useStore.getState().setCurrentProfileId(profile.id)
          useStore.getState().setCurrentRole(profile.role)
        } else if (!localUserId) {
          // Ni sesión local ni profile → realmente no hay sesión.
          useStore.getState().setCurrentProfileId(null)
          useStore.getState().setCurrentRole(null)
        }

        // Sin profile (offline o sin sesión) → no seguimos con la carga de datos
        // de red, pero el id local ya quedó seteado para poder registrar offline.
        if (!profile) return

        const [
          containersRaw, sessionsRaw, routeEventsRaw, dirtyLinks, cleanLinks, photosRaw,
          storageRaw, treatmentRaw, transfersRaw, locationsRaw, profilesRaw,
        ] = await Promise.all([
            q.listContainers(supabase),
            q.listWeighingSessions(supabase),
            q.listRouteEvents(supabase),
            q.listAllRouteContainersDirty(supabase),
            q.listAllRouteContainersClean(supabase),
            q.listAllPhotos(supabase),
            q.listStorageEvents(supabase),
            q.listTreatmentRuns(supabase),
            q.listExternalTransfers(supabase),
            q.listContainerLocations(supabase),
            q.listProfiles(supabase),
          ])
        if (cancelled) return

        const containers = containersRaw.map(rowToContainer)

        // Fotos: URLs firmadas + índice event_id → photo_ids[] para reconstruir
        // los `photo_ids` inline de recepciones y recorridos.
        const urlMap = await q.getPhotoUrls(supabase, photosRaw)
        if (cancelled) return
        const photos: Photo[] = photosRaw.map((p) => ({
          id: p.id,
          url: urlMap.get(p.id) ?? p.url ?? '',
          event_type: p.event_type,
          event_id: p.event_id,
          taken_at: p.taken_at,
          label: p.label,
        }))
        const photoIdsByEvent = new Map<string, string[]>()
        for (const p of photosRaw) {
          const arr = photoIdsByEvent.get(p.event_id) ?? []
          arr.push(p.id)
          photoIdsByEvent.set(p.event_id, arr)
        }

        const { dirtyByEvent: dirtyPhotosByEvent, cleanByEvent: cleanPhotosByEvent, signatureByEvent } =
          groupRoutePhotosByRole(photosRaw)

        const routeEvents = mapRouteEvents(routeEventsRaw, dirtyLinks, cleanLinks).map((e) => ({
          ...e,
          photo_ids: photoIdsByEvent.get(e.id) ?? [],
          dirty_photo_ids: dirtyPhotosByEvent.get(e.id) ?? [],
          clean_photo_ids: cleanPhotosByEvent.get(e.id) ?? [],
          signature_photo_id: signatureByEvent.get(e.id) ?? null,
        }))

        // Traer todas las receptions de las sesiones en una sola query y
        // luego agruparlas para derivar reception_ids[] por sesión.
        const sessionIds = sessionsRaw.map((s) => s.id)
        const receptionsRaw =
          sessionIds.length === 0
            ? []
            : await q.listReceptionsBySessionIds(supabase, sessionIds)
        if (cancelled) return

        const receptionIdsBySession = buildReceptionIdsBySession(receptionsRaw)
        const weighingSessions: WeighingSession[] = sessionsRaw.map((s) =>
          mapWeighingSessionRow(s, receptionIdsBySession)
        )

        const receptions: ContainerReception[] = receptionsRaw.map((r) => ({
          ...rowToReception(r),
          photo_ids: photoIdsByEvent.get(r.id) ?? [],
        }))

        const storageEvents: StorageEvent[] = storageRaw.map(rowToStorageEvent)
        const treatmentRuns: TreatmentRun[] = treatmentRaw.map(rowToTreatmentRun)
        const externalTransfers: ExternalTransfer[] = transfersRaw.map(rowToExternalTransfer)
        const locations: ContainerLocation[] = locationsRaw.map(rowToLocation)
        const users = profilesRaw.map((p) => ({ id: p.id, name: p.name }))

        const pend = await localPendingIds(localStore)
        const prev = useStore.getState()
        useStore.getState().hydrate({
          containers,
          weighingSessions: mergeById(weighingSessions, prev.weighingSessions, pend),
          receptions: mergeById(receptions, prev.receptions, pend),
          routeEvents: mergeById(routeEvents, prev.routeEvents, pend),
          photos,
          storageEvents: mergeById(storageEvents, prev.storageEvents, pend),
          treatmentRuns: mergeById(treatmentRuns, prev.treatmentRuns, pend),
          externalTransfers,
          locations: mergeById(locations, prev.locations, pend),
          users,
        })
        // Éxito: marcamos la conexión como online.
        useStore.getState().setConnectionStatus('online')
      } catch (err) {
        // Falla de red: el store ya quedó hidratado desde el LocalStore arriba
        // (los registros del dispositivo), así que no vaciamos nada acá — solo
        // avisamos al usuario vía banner.
        // eslint-disable-next-line no-console
        console.error('[SupabaseHydrator] hydration failed:', err)
        if (!cancelled) useStore.getState().setConnectionStatus('error')
      }
    }

    load()

    // Re-hidratar en cambios de sesión (login / logout)
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED') {
        load()
      }
    })

    // Reintentar cuando vuelve la conexión, cuando la pestaña vuelve a foco,
    // o cuando el usuario toca "Reintentar" en el banner.
    function retry() { load() }
    function onVisible() { if (document.visibilityState === 'visible') load() }
    window.addEventListener('online', retry)
    window.addEventListener('hospiwaste:retry-hydration', retry)
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      cancelled = true
      sub.subscription.unsubscribe()
      window.removeEventListener('online', retry)
      window.removeEventListener('hospiwaste:retry-hydration', retry)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  return null
}

// ─── local-first: LocalStore snapshot → store Zustand ──────────────────────

function buildReceptionIdsBySession(
  receptions: Array<{ id: string; weighing_session_id: string | null }>
): Map<string, string[]> {
  const map = new Map<string, string[]>()
  for (const r of receptions) {
    if (!r.weighing_session_id) continue
    const arr = map.get(r.weighing_session_id) ?? []
    arr.push(r.id)
    map.set(r.weighing_session_id, arr)
  }
  return map
}

function mapWeighingSessionRow(
  s: {
    id: string
    client_id: string
    date: string
    started_at: string
    ended_at: string | null
    operator_id: string
    status: 'in_progress' | 'completed'
    voided_at?: string | null
    voided_by?: string | null
    void_reason?: string | null
  },
  receptionIdsBySession: Map<string, string[]>
): WeighingSession {
  return {
    id: s.id,
    client_id: s.client_id,
    date: s.date,
    started_at: s.started_at,
    ended_at: s.ended_at,
    operator_id: s.operator_id,
    status: s.status,
    reception_ids: receptionIdsBySession.get(s.id) ?? [],
    voided_at: s.voided_at ?? null,
    voided_by: s.voided_by ?? null,
    void_reason: s.void_reason ?? null,
  }
}

/** `dirtyByEvent`/`cleanByEvent` (Maps que arma `hydrateFromLocal`) → links planos,
 *  para reusar `mapRouteEvents` (que espera arrays tipo `RouteContainerLink`). */
function linksFromMap(m: Map<string, string[]>): q.RouteContainerLink[] {
  const out: q.RouteContainerLink[] = []
  for (const [route_event_id, ids] of m) {
    for (const container_id of ids) out.push({ route_event_id, container_id })
  }
  return out
}

/**
 * Hidrata el store Zustand con el snapshot del LocalStore del dispositivo,
 * usando el mismo mapeo fila→estado que el fetch a Supabase. Se llama SIEMPRE
 * antes de tocar la red: si el fetch falla (offline), esto ya quedó en el
 * store y el catch de `load()` no lo pisa.
 *
 * Fotos quedan fuera a propósito: el LocalStore guarda binarios locales (no
 * URLs), y el sync engine ya se encarga de subirlas — no se pierden aunque no
 * se hidraten acá. Prioridad: registros primero (route_events, sessions,
 * receptions, joins).
 */
function hydrateLocalIntoStore(local: LocalSnapshot): void {
  const receptionIdsBySession = buildReceptionIdsBySession(
    local.receptions as unknown as Array<{ id: string; weighing_session_id: string | null }>
  )
  const weighingSessions = local.weighingSessions.map((s) =>
    mapWeighingSessionRow(s as unknown as Parameters<typeof mapWeighingSessionRow>[0], receptionIdsBySession)
  )
  const receptions = local.receptions.map((r) => rowToReception(r as unknown as q.ReceptionRow))
  const routeEvents = mapRouteEvents(
    local.routeEvents as unknown as q.RouteEventRow[],
    linksFromMap(local.dirtyByEvent),
    linksFromMap(local.cleanByEvent)
  )
  const storageEvents = local.storageEvents.map((r) => rowToStorageEvent(r as unknown as q.StorageEventRow))
  const treatmentRuns = local.treatmentRuns.map((r) => rowToTreatmentRun(r as unknown as q.TreatmentRunRow))
  const locations = local.containerLocations.map((r) => rowToLocation(r as unknown as q.ContainerLocationRow))

  useStore.getState().hydrate({
    weighingSessions,
    receptions,
    routeEvents,
    storageEvents,
    treatmentRuns,
    locations,
  })
}

// ─── adapters BD → store types ─────────────────────────────────────────────

function rowToContainer(r: q.ContainerRow): Container {
  return {
    id: r.id,
    size_liters: Number(r.size_liters) as 120 | 240 | 750 | 1100,
    tare_weight_kg: Number(r.tare_weight_kg),
    status: r.status,
    registered_at: r.registered_at,
    is_yaris_dedicated: r.is_yaris_dedicated,
    is_metallic_dedicated: r.is_metallic_dedicated,
    is_yaris_container: r.is_yaris_container,
    created_by: r.created_by ?? null,
  }
}

function rowToReception(r: q.ReceptionRow): ContainerReception {
  return {
    id: r.id,
    container_id: r.container_id,
    weighing_session_id: r.weighing_session_id,
    arrived_at: r.arrived_at,
    gross_weight_kg: Number(r.gross_weight_kg),
    operator_id: r.operator_id,
    photo_ids: [], // el hydrator los rellena desde photoIdsByEvent
    observations: r.observations,
    company_id: r.company_id ?? null,
    waste_type: r.waste_type,
    treat_immediately: r.treat_immediately,
    voided_at: r.voided_at ?? null,
    voided_by: r.voided_by ?? null,
    void_reason: r.void_reason ?? null,
  }
}

/**
 * Combina las filas de `route_events` con sus join tables dirty/clean para
 * reconstruir los `RouteEvent` del store (que llevan los IDs de tachos inline).
 * Pura y exportada para poder testearla sin Supabase.
 */
export function mapRouteEvents(
  events: q.RouteEventRow[],
  dirtyLinks: q.RouteContainerLink[],
  cleanLinks: q.RouteContainerLink[]
): RouteEvent[] {
  const dirtyByEvent = groupContainers(dirtyLinks)
  const cleanByEvent = groupContainers(cleanLinks)
  return events.map((e) => ({
    id: e.id,
    client_id: e.client_id,
    company_id: e.company_id ?? null,
    kind: e.kind,
    slot: e.slot,
    date: e.date,
    started_at: e.started_at,
    ended_at: e.ended_at,
    operator_id: e.operator_id,
    status: e.status,
    containers_dirty_received: dirtyByEvent.get(e.id) ?? [],
    containers_clean_delivered: cleanByEvent.get(e.id) ?? [],
    area: e.area,
    photo_ids: [], // el hydrator los rellena desde photoIdsByEvent
    dirty_photo_ids: [],
    clean_photo_ids: [],
    voided_at: e.voided_at ?? null,
    voided_by: e.voided_by ?? null,
    void_reason: e.void_reason ?? null,
  }))
}

/** Agrupa las fotos de eventos 'route' por rol (dirty/clean/signature) y por event_id.
 *  Las fotos sin role (legacy/pesaje) se ignoran. La firma es una sola por evento
 *  (si hubiera más de una, gana la última). Exportada para test. */
export function groupRoutePhotosByRole(photos: q.PhotoRow[]): {
  dirtyByEvent: Map<string, string[]>
  cleanByEvent: Map<string, string[]>
  signatureByEvent: Map<string, string>
} {
  const dirtyByEvent = new Map<string, string[]>()
  const cleanByEvent = new Map<string, string[]>()
  const signatureByEvent = new Map<string, string>()
  for (const p of photos) {
    if (p.event_type !== 'route') continue
    if (p.role === 'signature') {
      signatureByEvent.set(p.event_id, p.id)
      continue
    }
    const target = p.role === 'dirty' ? dirtyByEvent : p.role === 'clean' ? cleanByEvent : null
    if (!target) continue
    const arr = target.get(p.event_id) ?? []
    arr.push(p.id)
    target.set(p.event_id, arr)
  }
  return { dirtyByEvent, cleanByEvent, signatureByEvent }
}

function groupContainers(links: q.RouteContainerLink[]): Map<string, string[]> {
  const map = new Map<string, string[]>()
  for (const l of links) {
    const arr = map.get(l.route_event_id) ?? []
    arr.push(l.container_id)
    map.set(l.route_event_id, arr)
  }
  return map
}

export function rowToStorageEvent(r: q.StorageEventRow): StorageEvent {
  return {
    id: r.id,
    container_id: r.container_id,
    entry_at: r.entry_at,
    exit_at: r.exit_at,
    operator_id: r.operator_id,
    photo_ids: [],
  }
}

export function rowToTreatmentRun(r: q.TreatmentRunRow): TreatmentRun {
  return {
    id: r.id,
    container_id: r.container_id,
    started_at: r.started_at,
    completed_at: r.completed_at,
    operator_id: r.operator_id,
  }
}

export function rowToExternalTransfer(r: q.ExternalTransferRow): ExternalTransfer {
  return {
    id: r.id,
    container_id: r.container_id,
    storage_started_at: r.storage_started_at,
    transferred_at: r.transferred_at,
    destination: r.destination,
    operator_id: r.operator_id,
  }
}

export function rowToLocation(r: q.ContainerLocationRow): ContainerLocation {
  return {
    id: r.id,
    container_id: r.container_id,
    reported_at: r.reported_at,
    operator_id: r.operator_id,
    location_type: r.location_type,
    client_id: r.client_id,
    floor: r.floor,
    area: r.area,
    notes: r.notes,
  }
}
