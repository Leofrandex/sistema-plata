'use client'

import Link from 'next/link'
import { cn } from '@hospiwaste/shared/lib/utils'
import { formatDaysRemaining, type MaintenanceStatus, type MaintenanceState } from '@/lib/data/equipment-status'

export interface EquipmentTableRow {
  id: string
  name: string
  identification: string | null
  brand: string | null
  model: string | null
  serial: string | null
  status: MaintenanceStatus
}

export const STATE_LABELS: Record<MaintenanceState, string> = {
  ok: 'Al día',
  due_soon: 'Próximo',
  overdue: 'Vencido',
  unconfigured: 'Sin configurar',
}

const STATE_DOT: Record<MaintenanceState, string> = {
  ok: 'bg-emerald-500',
  due_soon: 'bg-amber-400',
  overdue: 'bg-red-500',
  unconfigured: 'bg-slate-300',
}

const STATE_TEXT: Record<MaintenanceState, string> = {
  ok: 'text-emerald-700',
  due_soon: 'text-amber-700',
  overdue: 'text-red-700',
  unconfigured: 'text-slate-400',
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

export function EquipmentTable({ rows }: { rows: EquipmentTableRow[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border bg-white">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-slate-50 text-slate-500 text-left">
            <th className="px-4 py-3 font-medium">Estado</th>
            <th className="px-4 py-3 font-medium">Equipo</th>
            <th className="px-4 py-3 font-medium">Marca / Modelo</th>
            <th className="px-4 py-3 font-medium">Último mantenimiento</th>
            <th className="px-4 py-3 font-medium">Próximo</th>
            <th className="px-4 py-3 font-medium">Días restantes</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((r) => (
            <tr key={r.id} className="hover:bg-slate-50">
              <td className="px-4 py-3">
                <span className={cn('inline-flex items-center gap-2 font-medium', STATE_TEXT[r.status.state])}>
                  <span className={cn('h-2.5 w-2.5 rounded-full shrink-0', STATE_DOT[r.status.state])} />
                  {STATE_LABELS[r.status.state]}
                </span>
              </td>
              <td className="px-4 py-3">
                <Link href={`/equipment/detail?id=${r.id}`} className="font-semibold text-slate-800 hover:underline">
                  {r.name}
                  {r.identification && <span className="text-slate-400 font-normal"> · {r.identification}</span>}
                </Link>
              </td>
              <td className="px-4 py-3 text-slate-600">
                {[r.brand, r.model].filter(Boolean).join(' / ') || '—'}
              </td>
              <td className="px-4 py-3 text-slate-600">{formatDate(r.status.lastPerformedAt)}</td>
              <td className="px-4 py-3 text-slate-600">{formatDate(r.status.nextDueAt)}</td>
              <td className={cn('px-4 py-3 font-medium', STATE_TEXT[r.status.state])}>
                {formatDaysRemaining(r.status)}
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">Sin equipos que coincidan con el filtro</td></tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
