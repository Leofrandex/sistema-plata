'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Plus, Loader2, Search } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import * as q from '@/lib/supabase/queries'
import {
  computeMaintenanceStatus, compareByUrgency, todayISO,
  type MaintenanceState,
} from '@/lib/data/equipment-status'
import { EquipmentTable, STATE_LABELS, type EquipmentTableRow } from '@/components/equipment/equipment-table'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type StateFilter = MaintenanceState | 'all'

export default function EquipmentPage() {
  const [equipment, setEquipment] = useState<q.EquipmentRow[]>([])
  const [lastDates, setLastDates] = useState<Map<string, string>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [stateFilter, setStateFilter] = useState<StateFilter>('all')

  useEffect(() => {
    const db = createClient()
    Promise.all([q.listEquipment(db), q.listLatestMaintenanceByEquipment(db)])
      .then(([eq, dates]) => { setEquipment(eq); setLastDates(dates) })
      .catch((err) => {
        console.error('[equipment] cargar equipos falló:', err)
        setError('No se pudieron cargar los equipos. Revisa tu conexión e intenta de nuevo.')
      })
      .finally(() => setLoading(false))
  }, [])

  const rows: EquipmentTableRow[] = useMemo(() => {
    const today = todayISO()
    return equipment
      .map((e) => ({
        id: e.id,
        name: e.name,
        identification: e.identification,
        brand: e.brand,
        model: e.model,
        serial: e.serial,
        status: computeMaintenanceStatus({
          frequencyDays: e.maintenance_frequency_days,
          lastPerformedAt: lastDates.get(e.id) ?? null,
          today,
        }),
      }))
      .sort((a, b) => compareByUrgency(a.status, b.status))
  }, [equipment, lastDates])

  const counts = useMemo(() => {
    const c: Record<MaintenanceState, number> = { overdue: 0, due_soon: 0, ok: 0, unconfigured: 0 }
    for (const r of rows) c[r.status.state]++
    return c
  }, [rows])

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return rows.filter((r) => {
      if (stateFilter !== 'all' && r.status.state !== stateFilter) return false
      if (!needle) return true
      return [r.name, r.identification, r.brand, r.model, r.serial]
        .some((v) => v?.toLowerCase().includes(needle))
    })
  }, [rows, search, stateFilter])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">Equipos</h1>
        <Link href="/equipment/detail" className={cn(buttonVariants({ variant: 'default' }), 'gap-2')}>
          <Plus className="h-4 w-4" />Nuevo equipo
        </Link>
      </div>

      <p className="text-sm text-slate-500">
        <span className="font-medium text-red-700">{counts.overdue} vencidos</span>
        {' · '}
        <span className="font-medium text-amber-700">{counts.due_soon} próximos</span>
        {' · '}
        <span className="font-medium text-emerald-700">{counts.ok} al día</span>
        {' · '}
        <span>{counts.unconfigured} sin configurar</span>
      </p>

      <div className="flex flex-wrap gap-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar equipo, marca, identificación…"
            className="pl-8 pr-3 py-2 rounded-lg border border-slate-200 bg-white text-sm w-72 outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <select
          value={stateFilter}
          onChange={(e) => setStateFilter(e.target.value as StateFilter)}
          className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-primary/30"
        >
          <option value="all">Todos los estados</option>
          <option value="overdue">{STATE_LABELS.overdue}</option>
          <option value="due_soon">{STATE_LABELS.due_soon}</option>
          <option value="ok">{STATE_LABELS.ok}</option>
          <option value="unconfigured">{STATE_LABELS.unconfigured}</option>
        </select>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {loading ? (
        <div className="flex items-center gap-2 text-slate-500 py-8"><Loader2 className="h-4 w-4 animate-spin" />Cargando equipos…</div>
      ) : (
        <EquipmentTable rows={filtered} />
      )}
    </div>
  )
}
