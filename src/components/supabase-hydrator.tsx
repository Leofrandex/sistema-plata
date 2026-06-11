'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import * as q from '@/lib/supabase/queries'
import { useStore } from '@/lib/store'
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
} from '@/lib/types'

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
      try {
        // Profile del usuario actual (puede ser null si no hay sesión)
        const profile = await q.getCurrentProfile(supabase)
        if (cancelled) return
        useStore.getState().setCurrentProfileId(profile?.id ?? null)
        useStore.getState().setCurrentRole(profile?.role ?? null)

        // Sin sesión → no traer datos (el middleware redirige a /login)
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

        const { dirtyByEvent: dirtyPhotosByEvent, cleanByEvent: cleanPhotosByEvent } =
          groupRoutePhotosByRole(photosRaw)

        const routeEvents = mapRouteEvents(routeEventsRaw, dirtyLinks, cleanLinks).map((e) => ({
          ...e,
          photo_ids: photoIdsByEvent.get(e.id) ?? [],
          dirty_photo_ids: dirtyPhotosByEvent.get(e.id) ?? [],
          clean_photo_ids: cleanPhotosByEvent.get(e.id) ?? [],
        }))

        // Traer todas las receptions de las sesiones en una sola query y
        // luego agruparlas para derivar reception_ids[] por sesión.
        const sessionIds = sessionsRaw.map((s) => s.id)
        const receptionsRaw =
          sessionIds.length === 0
            ? []
            : await q.listReceptionsBySessionIds(supabase, sessionIds)
        if (cancelled) return

        const receptionIdsBySession = new Map<string, string[]>()
        for (const r of receptionsRaw) {
          if (!r.weighing_session_id) continue
          const arr = receptionIdsBySession.get(r.weighing_session_id) ?? []
          arr.push(r.id)
          receptionIdsBySession.set(r.weighing_session_id, arr)
        }

        const weighingSessions: WeighingSession[] = sessionsRaw.map((s) => ({
          id: s.id,
          client_id: s.client_id,
          date: s.date,
          started_at: s.started_at,
          ended_at: s.ended_at,
          operator_id: s.operator_id,
          status: s.status,
          reception_ids: receptionIdsBySession.get(s.id) ?? [],
        }))

        const receptions: ContainerReception[] = receptionsRaw.map((r) => ({
          ...rowToReception(r),
          photo_ids: photoIdsByEvent.get(r.id) ?? [],
        }))

        const storageEvents: StorageEvent[] = storageRaw.map(rowToStorageEvent)
        const treatmentRuns: TreatmentRun[] = treatmentRaw.map(rowToTreatmentRun)
        const externalTransfers: ExternalTransfer[] = transfersRaw.map(rowToExternalTransfer)
        const locations: ContainerLocation[] = locationsRaw.map(rowToLocation)
        const users = profilesRaw.map((p) => ({ id: p.id, name: p.name }))

        useStore.getState().hydrate({
          containers,
          weighingSessions,
          receptions,
          routeEvents,
          photos,
          storageEvents,
          treatmentRuns,
          externalTransfers,
          locations,
          users,
        })
        // Éxito: marcamos la conexión como online.
        useStore.getState().setConnectionStatus('online')
      } catch (err) {
        // Falla: la app sigue con mocks, pero avisamos al usuario vía banner.
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
  }))
}

/** Agrupa las fotos de eventos 'route' por rol (dirty/clean) y por event_id.
 *  Las fotos sin role (legacy/pesaje) se ignoran. Exportada para test. */
export function groupRoutePhotosByRole(photos: q.PhotoRow[]): {
  dirtyByEvent: Map<string, string[]>
  cleanByEvent: Map<string, string[]>
} {
  const dirtyByEvent = new Map<string, string[]>()
  const cleanByEvent = new Map<string, string[]>()
  for (const p of photos) {
    if (p.event_type !== 'route') continue
    const target = p.role === 'dirty' ? dirtyByEvent : p.role === 'clean' ? cleanByEvent : null
    if (!target) continue
    const arr = target.get(p.event_id) ?? []
    arr.push(p.id)
    target.set(p.event_id, arr)
  }
  return { dirtyByEvent, cleanByEvent }
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
