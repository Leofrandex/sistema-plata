'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ROUTE_SLOTS } from '@/lib/constants'
import { useStore } from '@/lib/store'
import {
  listActiveSessions,
  endSession,
  routeAndenSessionKey,
  todayLocal,
  type ActiveSession,
} from '@/lib/active-session'
import { RouteSlotCard, type RouteSlotStatus } from '@/components/register/route-slot-card'
import { computeSlotStatus } from '@/lib/data/route-sessions'
import type { RouteSlot } from '@/lib/types'

interface SlotState {
  status: RouteSlotStatus
  startedAt?: string | null
  completedAt?: string | null
}

export default function RegisterAndenRoutesPage() {
  const { routeEvents } = useStore()
  const [today, setToday] = useState<string>(todayLocal)
  const [activeSessions, setActiveSessions] = useState<ActiveSession[]>([])

  useEffect(() => {
    const interval = setInterval(() => setToday(todayLocal()), 60_000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    let cancelled = false
    listActiveSessions('route')
      .then(async (sessions) => {
        if (cancelled) return
        const andenSessions = sessions.filter(
          (s) => s.context.type === 'route' && s.context.kind === 'anden',
        )
        // Reconciliar contra la BD: descartar (y borrar de IndexedDB) las sesiones
        // colgadas cuyo horario ya está cerrado en Supabase. Sin esto, una sesión
        // local fantasma mantenía el slot "en curso" para siempre.
        const events = useStore.getState().routeEvents
        const live: ActiveSession[] = []
        for (const s of andenSessions) {
          const ctx = s.context
          if (ctx.type !== 'route' || ctx.slot == null) { live.push(s); continue }
          const d = computeSlotStatus(events, ctx.date, ctx.slot, s.started_at)
          if (d.staleLocalSession) {
            await endSession(s.key)
          } else {
            live.push(s)
          }
        }
        if (!cancelled) setActiveSessions(live)
      })
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.error('[route-anden-list] Error leyendo sesiones activas:', err)
        if (!cancelled) setActiveSessions([])
      })
    return () => { cancelled = true }
  }, [today, routeEvents])

  function computeStatus(slot: RouteSlot): SlotState {
    const localSession = activeSessions.find((s) => s.key === routeAndenSessionKey(today, slot))
    const d = computeSlotStatus(routeEvents, today, slot, localSession?.started_at ?? null)
    return { status: d.status, startedAt: d.startedAt, completedAt: d.completedAt }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/register/route">
          <Button variant="ghost" size="icon" aria-label="Volver">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <header>
          <h1 className="text-2xl font-bold text-foreground">Recorridos de andén</h1>
          <p className="text-sm text-muted-foreground mt-1">
            6 recorridos diarios con horario fijo. Una vez finalizada una ruta del día,
            no se puede volver a iniciar hasta el día siguiente.
          </p>
        </header>
      </div>

      <div className="space-y-3">
        {ROUTE_SLOTS.map((slot) => {
          const state = computeStatus(slot.id)
          return (
            <RouteSlotCard
              key={slot.id}
              slot={slot}
              status={state.status}
              startedAt={state.startedAt}
              completedAt={state.completedAt}
            />
          )
        })}
      </div>
    </div>
  )
}
