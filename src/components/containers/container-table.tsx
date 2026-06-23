'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { circulationColor, circulationLabel, formatDuration } from '@/lib/data/dashboard-metrics'
import type { CirculationBucket } from '@/lib/data/dashboard-metrics'
import type { ContainerSize } from '@/lib/types'
import { formatTachoNumber } from '@/lib/data/containers'

export interface TachoRow {
  id: string
  size_liters: ContainerSize
  bucket: CirculationBucket
  sinceMs: number | null
  company_id: string | null
}

interface Props {
  rows: TachoRow[]
  now: number
}

export function ContainerTable({ rows, now }: Props) {
  const router = useRouter()

  if (rows.length === 0) {
    return (
      <div className="rounded-xl bg-card p-12 text-center text-muted-foreground ring-1 ring-foreground/10">
        No se encontraron tachos.
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-xl bg-card ring-1 ring-foreground/10">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <th className="px-4 py-3">Tacho</th>
            <th className="px-4 py-3">Tamaño</th>
            <th className="px-4 py-3">Fase</th>
            <th className="px-4 py-3">Tiempo en fase</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((c) => {
            const href = `/containers/detail?id=${c.id}`
            const tiempo = c.sinceMs == null ? '—' : formatDuration(Math.max(0, now - c.sinceMs))
            return (
              <tr
                key={c.id}
                tabIndex={0}
                aria-label={`Ver tacho ${formatTachoNumber(c.id)}`}
                onClick={() => {
                  if (typeof window !== 'undefined' && window.getSelection()?.toString()) return
                  router.push(href)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    router.push(href)
                  }
                }}
                className="cursor-pointer transition-colors outline-none hover:bg-accent/5 focus-visible:bg-accent/10 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
              >
                <td className="px-4 py-3">
                  <Link
                    href={href}
                    onClick={(e) => e.stopPropagation()}
                    className="font-mono font-semibold text-accent hover:underline"
                  >
                    {formatTachoNumber(c.id)}
                  </Link>
                </td>
                <td className="px-4 py-3 text-foreground/80">{c.size_liters} L</td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="inline-block size-2 rounded-full" style={{ backgroundColor: circulationColor(c.bucket) }} />
                    {circulationLabel(c.bucket)}
                  </span>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{tiempo}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
