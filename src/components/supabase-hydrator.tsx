'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import * as q from '@/lib/supabase/queries'
import { useStore } from '@/lib/store'
import type {
  Container,
  WeighingSession,
  ContainerReception,
} from '@/lib/types'

/**
 * Hidrata el store con datos de Supabase al montar y cada vez que cambia la
 * sesión auth. Mantiene la API del store intacta para que las pantallas que
 * todavía leen `useStore()` funcionen sin cambios.
 *
 * Para el piloto solo migramos el dominio de pesaje:
 *  - containers      ← Supabase
 *  - weighingSessions + receptions ← Supabase (computa reception_ids[] localmente)
 *  - currentProfileId ← profile del usuario logueado
 *
 * Lo demás (clients, companies, routeEvents, photos, storage…) sigue saliendo
 * de los mocks hasta que se migre en sesiones posteriores.
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

        // Sin sesión → no traer datos (el middleware redirige a /login)
        if (!profile) return

        const [containersRaw, sessionsRaw] = await Promise.all([
          q.listContainers(supabase),
          q.listWeighingSessions(supabase),
        ])
        if (cancelled) return

        const containers = containersRaw.map(rowToContainer)

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

        const receptions: ContainerReception[] = receptionsRaw.map(rowToReception)

        useStore.getState().hydrate({
          containers,
          weighingSessions,
          receptions,
        })
      } catch (err) {
        // No-op: si falla la hidratación, la app sigue con mocks.
        // eslint-disable-next-line no-console
        console.error('[SupabaseHydrator] hydration failed:', err)
      }
    }

    load()

    // Re-hidratar en cambios de sesión (login / logout)
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED') {
        load()
      }
    })

    return () => {
      cancelled = true
      sub.subscription.unsubscribe()
    }
  }, [])

  return null
}

// ─── adapters BD → store types ─────────────────────────────────────────────

function rowToContainer(r: q.ContainerRow): Container {
  return {
    id: r.id,
    company_id: r.company_id ?? '', // store espera string; pilot piloto permite ''
    size_liters: Number(r.size_liters) as 240 | 750 | 1100,
    tare_weight_kg: Number(r.tare_weight_kg),
    waste_type: r.waste_type,
    status: r.status,
    registered_at: r.registered_at,
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
    photo_ids: [], // fotos por ahora viven en memoria (mock); fase 5 las trae de Storage
    observations: r.observations,
  }
}
