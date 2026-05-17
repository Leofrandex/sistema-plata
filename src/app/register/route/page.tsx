'use client'

import { useEffect, useState } from 'react'
import { ROUTE_SLOTS } from '@/lib/constants'
import { useStore } from '@/lib/store'
import {
  listActiveSessions,
  routeSessionKey,
  todayLocal,
  type ActiveSession,
} from '@/lib/active-session'
import { RouteSlotCard, type RouteSlotStatus } from '@/components/register/route-slot-card'
import type { RouteSlot } from '@/lib/types'

interface SlotState {
  status: RouteSlotStatus
  startedAt?: string | null
  completedAt?: string | null
}

export default function RegisterRoutesPage() {
  const { routeEvents } = useStore()
  const [today, setToday] = useState<string>(todayLocal)
  const [activeSessions, setActiveSessions] = useState<ActiveSession[]>([])

  // Refresca la fecha cada minuto por si pasamos medianoche con la app abierta
  useEffect(() => {
    const interval = setInterval(() => setToday(todayLocal()), 60_000)
    return () => clearInterval(interval)
  }, [])

  // Carga las sesiones activas desde IndexedDB (cronómetros persistentes)
  useEffect(() => {
    let cancelled = false
    listActiveSessions('route').then((sessions) => {
      if (!cancelled) setActiveSessions(sessions)
    })
    return () => { cancelled = true }
  }, [today, routeEvents])

  function computeStatus(slot: RouteSlot): SlotState {
    const inProgressKey = routeSessionKey(today, slot)
    const inProgressSession = activeSessions.find((s) => s.key === inProgressKey)
    if (inProgressSession) {
      return { status: 'in_progress', startedAt: inProgressSession.started_at }
    }
    const completed = routeEvents.find(
      (r) => r.slot === slot && r.date === today && r.status === 'completed',
    )
    if (completed) {
      return { status: 'completed', completedAt: completed.ended_at }
    }
    return { status: 'available' }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-foreground">Recorridos</h1>
        <p className="text-sm text-muted-foreground mt-1">
          6 recorridos diarios con horario fijo. Una vez finalizada una ruta del día,
          no se puede volver a iniciar hasta el día siguiente.
        </p>
      </header>

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
