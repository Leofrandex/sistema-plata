'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Route as RouteIcon, Scale, Flame, Truck, CheckCircle2, CircleDashed, Timer } from 'lucide-react'
import { HomeHero } from '@/components/home/home-hero'
import { useStore } from '@hospiwaste/shared/lib/store'
import { ROUTE_SLOTS } from '@hospiwaste/shared/lib/constants'
import { computeSlotStatus, type SlotStatus } from '@hospiwaste/shared/lib/data/route-sessions'
import { getActiveSession, routeAndenSessionKey, todayLocal } from '@/lib/active-session'
import { cn } from '@hospiwaste/shared/lib/utils'

const ACTIONS = [
  { href: '/register/route',     label: 'Recorrido',        icon: RouteIcon, style: 'bg-accent/10 text-accent' },
  { href: '/register/weighing',  label: 'Pesaje',           icon: Scale,     style: 'bg-amber-100 text-amber-700' },
  { href: '/register/treatment', label: 'Tratamiento',      icon: Flame,     style: 'bg-violet-100 text-violet-700' },
  { href: '/register/transfer',  label: 'Traslado externo', icon: Truck,     style: 'bg-emerald-100 text-emerald-700' },
]

const SLOT_META: Record<SlotStatus, { label: string; dot: string }> = {
  available:   { label: 'Pendiente', dot: 'bg-slate-300' },
  in_progress: { label: 'En curso',  dot: 'bg-amber-500' },
  completed:   { label: 'Hecho',     dot: 'bg-green-600' },
}

export default function HomePage() {
  const { users, currentProfileId, routeEvents } = useStore()
  const [localStarts, setLocalStarts] = useState<Record<string, string | null>>({})

  const firstName = useMemo(() => {
    const full = users.find((u) => u.id === currentProfileId)?.name
    return full ? full.split(' ')[0] : undefined
  }, [users, currentProfileId])

  const today = useMemo(() => todayLocal(), [])

  // Sesiones locales (cronómetro IndexedDB) por slot, para reflejar "en curso"
  // aunque aún no se haya guardado ningún andén.
  useEffect(() => {
    let cancelled = false
    async function load() {
      const entries = await Promise.all(
        ROUTE_SLOTS.map(async (slot) => {
          const session = await getActiveSession(routeAndenSessionKey(today, slot.id))
          return [slot.id, session?.started_at ?? null] as const
        }),
      )
      if (!cancelled) setLocalStarts(Object.fromEntries(entries))
    }
    load()
    return () => { cancelled = true }
  }, [today])

  const slots = useMemo(
    () =>
      ROUTE_SLOTS.map((slot) => ({
        id: slot.id,
        shortLabel: slot.shortLabel,
        ...computeSlotStatus(routeEvents, today, slot.id, localStarts[slot.id] ?? null),
      })),
    [routeEvents, today, localStarts],
  )

  const doneCount = slots.filter((s) => s.status === 'completed').length

  return (
    <div className="space-y-5 pb-8">
      <HomeHero name={firstName} />

      {/* Accesos directos: botones grandes, pensados para uso en campo */}
      <div className="grid grid-cols-2 gap-3">
        {ACTIONS.map(({ href, label, icon: Icon, style }) => (
          <Link
            key={href}
            href={href}
            className="flex flex-col items-center justify-center gap-3 rounded-xl bg-card p-6 ring-1 ring-foreground/10 transition-all active:scale-[0.98] hover:shadow-md"
          >
            <span className={cn('flex size-14 items-center justify-center rounded-2xl', style)}>
              <Icon className="size-7" />
            </span>
            <span className="text-sm font-semibold text-foreground">{label}</span>
          </Link>
        ))}
      </div>

      {/* Estado de los 6 horarios de recorrido del día */}
      <section className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Recorridos de hoy</h2>
          <span className="text-xs font-medium text-muted-foreground">
            {doneCount}/{slots.length} completados
          </span>
        </div>
        <ul className="grid grid-cols-2 gap-2">
          {slots.map(({ id, shortLabel, status }) => {
            const meta = SLOT_META[status]
            return (
              <li
                key={id}
                className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2"
              >
                {status === 'completed' ? (
                  <CheckCircle2 className="size-4 text-green-600" />
                ) : status === 'in_progress' ? (
                  <Timer className="size-4 text-amber-500" />
                ) : (
                  <CircleDashed className="size-4 text-slate-400" />
                )}
                <span className="text-sm font-semibold tabular-nums text-foreground">{shortLabel}</span>
                <span className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className={cn('size-1.5 rounded-full', meta.dot)} />
                  {meta.label}
                </span>
              </li>
            )
          })}
        </ul>
      </section>
    </div>
  )
}
