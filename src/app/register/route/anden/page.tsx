'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ROUTE_SLOTS } from '@/lib/constants'
import { useStore } from '@/lib/store'
import {
  listActiveSessions,
  routeAndenSessionKey,
  todayLocal,
  type ActiveSession,
} from '@/lib/active-session'
import { RouteSlotCard, type RouteSlotStatus } from '@/components/register/route-slot-card'
import { getSlotAndenEvents } from '@/lib/data/route-sessions'
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
      .then((sessions) => {
        if (cancelled) return
        setActiveSessions(
          sessions.filter((s) => s.context.type === 'route' && s.context.kind === 'anden'),
        )
      })
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.error('[route-anden-list] Error leyendo sesiones activas:', err)
        if (!cancelled) setActiveSessions([])
      })
    return () => { cancelled = true }
  }, [today, routeEvents])

  function computeStatus(slot: RouteSlot): SlotState {
    const inProgressKey = routeAndenSessionKey(today, slot)
    const inProgressSession = activeSessions.find((s) => s.key === inProgressKey)
    const inProgress = getSlotAndenEvents(routeEvents, today, slot, 'in_progress')
    if (inProgressSession || inProgress.length > 0) {
      return { status: 'in_progress', startedAt: inProgressSession?.started_at ?? inProgress[0]?.started_at }
    }
    const completed = getSlotAndenEvents(routeEvents, today, slot, 'completed')
    if (completed.length > 0) {
      const last = completed[completed.length - 1]
      return { status: 'completed', completedAt: last.ended_at }
    }
    return { status: 'available' }
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
