'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Wrench, ChevronRight } from 'lucide-react'
import { createClient } from '@hospiwaste/shared/lib/supabase/client'
import * as q from '@hospiwaste/shared/lib/supabase/queries'
import {
  computeMaintenanceStatus,
  todayISO,
  type MaintenanceState,
} from '@/lib/data/equipment-status'
import { cn } from '@hospiwaste/shared/lib/utils'

interface Counts {
  overdue: number
  due_soon: number
  ok: number
  unconfigured: number
}

const CHIPS: Array<{ key: MaintenanceState; label: string; className: string }> = [
  { key: 'overdue', label: 'Vencidos', className: 'bg-red-50 text-red-700' },
  { key: 'due_soon', label: 'Próximos', className: 'bg-amber-50 text-amber-700' },
  { key: 'ok', label: 'Al día', className: 'bg-green-50 text-green-700' },
  { key: 'unconfigured', label: 'Sin config.', className: 'bg-muted text-muted-foreground' },
]

/** Resumen del semáforo de mantenimiento de equipos. Única tarjeta async del
 *  dashboard (equipos no viven en el store; se consultan a Supabase). */
export function EquipmentSummaryCard() {
  const [counts, setCounts] = useState<Counts | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const db = createClient()
        const [equipment, latestByEquipment] = await Promise.all([
          q.listEquipment(db),
          q.listLatestMaintenanceByEquipment(db),
        ])
        const today = todayISO()
        const next: Counts = { overdue: 0, due_soon: 0, ok: 0, unconfigured: 0 }
        for (const e of equipment) {
          if (!e.active) continue
          const status = computeMaintenanceStatus({
            frequencyDays: e.maintenance_frequency_days,
            lastPerformedAt: latestByEquipment.get(e.id) ?? null,
            today,
          })
          next[status.state] += 1
        }
        if (!cancelled) setCounts(next)
      } catch {
        if (!cancelled) setError(true)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  return (
    <section className="rounded-2xl bg-card p-5 ring-1 ring-foreground/10">
      <header className="mb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
            <Wrench className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Mantenimiento de equipos
            </h2>
            <p className="text-xs text-muted-foreground/80">Semáforo preventivo</p>
          </div>
        </div>
        <Link
          href="/equipment"
          className="flex items-center gap-0.5 text-xs font-medium text-accent hover:underline"
        >
          Ver equipos <ChevronRight className="size-3.5" />
        </Link>
      </header>

      {error ? (
        <p className="py-4 text-center text-sm text-muted-foreground">
          No se pudo cargar el estado de los equipos.
        </p>
      ) : counts === null ? (
        <div className="grid grid-cols-4 gap-2" aria-hidden>
          {CHIPS.map(({ key }) => (
            <div key={key} className="h-16 animate-pulse rounded-lg bg-muted/60" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-2">
          {CHIPS.map(({ key, label, className }) => (
            <div key={key} className={cn('flex flex-col items-center gap-0.5 rounded-lg px-2 py-2.5', className)}>
              <span className="text-lg font-bold tabular-nums leading-none">{counts[key]}</span>
              <span className="text-[11px] font-medium">{label}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
