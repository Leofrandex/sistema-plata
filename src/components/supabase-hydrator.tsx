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

        const [containersRaw, sessionsRaw, routeEventsRaw, dirtyLinks, cleanLinks, photosRaw] =
          await Promise.all([
            q.listContainers(supabase),
            q.listWeighingSessions(supabase),
            q.listRouteEvents(supabase),
            q.listAllRouteContainersDirty(supabase),
            q.listAllRouteContainersClean(supabase),
            q.listAllPhotos(supabase),
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

        const routeEvents = mapRouteEvents(routeEventsRaw, dirtyLinks, cleanLinks).map(
          (e) => ({ ...e, photo_ids: photoIdsByEvent.get(e.id) ?? [] })
        )

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

        useStore.getState().hydrate({
          containers,
          weighingSessions,
          receptions,
          routeEvents,
          photos,
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
    company_id: r.company_id ?? '', // store espera string; '' = sin empresa
    size_liters: Number(r.size_liters) as 120 | 240 | 750 | 1100,
    tare_weight_kg: Number(r.tare_weight_kg),
    status: r.status,
    registered_at: r.registered_at,
    is_yaris_dedicated: r.is_yaris_dedicated,
    is_metallic_dedicated: r.is_metallic_dedicated,
    is_yaris_container: r.is_yaris_container,
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
    floor: e.floor,
    area: e.area,
    dock: e.dock,
    photo_ids: [], // el hydrator los rellena desde photoIdsByEvent
  }))
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
