'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { FileText } from 'lucide-react'
import type { BatchWithClient } from '@/lib/types'

interface Props {
  batches: BatchWithClient[]
  clients: { id: string; name: string }[]
}

export function CompletedBatchesTab({ batches, clients }: Props) {
  const [clientFilter, setClientFilter] = useState<string>('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const filtered = useMemo(() => {
    return batches.filter((b) => {
      if (clientFilter !== 'all' && b.client_id !== clientFilter) return false
      if (dateFrom && b.date < dateFrom) return false
      if (dateTo && b.date > dateTo) return false
      return true
    })
  }, [batches, clientFilter, dateFrom, dateTo])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <Select value={clientFilter} onValueChange={(value) => setClientFilter(value ?? 'all')}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Todos los clientes" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los clientes</SelectItem>
            {clients.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="w-44"
        />
        <Input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="w-44"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          No hay lotes completados con esos filtros.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((batch) => (
            <div
              key={batch.id}
              className="flex items-center justify-between p-4 bg-white rounded-lg border"
            >
              <div className="space-y-1">
                <p className="font-medium text-slate-800">{batch.client.name}</p>
                <p className="text-sm text-slate-500">
                  {batch.container_count} envases · {batch.date}
                </p>
              </div>
              <Link href={`/batches/${batch.id}/report`}>
                <Button variant="outline" size="sm" className="gap-2">
                  <FileText className="h-4 w-4" />
                  Generar reporte
                </Button>
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
