'use client'

import { useId } from 'react'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface Props {
  clients: { id: string; name: string }[]
  clientFilter: string
  dateFrom: string
  dateTo: string
  onClientChange: (id: string) => void
  onDateFromChange: (date: string) => void
  onDateToChange: (date: string) => void
}

const labelClass = 'text-xs font-semibold uppercase tracking-wide text-muted-foreground'

export function CompletedBatchesFilters({
  clients, clientFilter, dateFrom, dateTo,
  onClientChange, onDateFromChange, onDateToChange,
}: Props) {
  const clientLabelId = useId()
  const fromId = useId()
  const toId = useId()

  return (
    <div className="grid grid-cols-1 gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10 sm:grid-cols-3">
      <div className="flex flex-col gap-1.5">
        <span id={clientLabelId} className={labelClass}>Cliente</span>
        <Select value={clientFilter} onValueChange={(v) => onClientChange(v ?? 'all')}>
          <SelectTrigger aria-labelledby={clientLabelId} className="w-full">
            <SelectValue placeholder="Todos los clientes" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los clientes</SelectItem>
            {clients.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={fromId} className={labelClass}>Desde</label>
        <Input
          id={fromId}
          type="date"
          value={dateFrom}
          onChange={(e) => onDateFromChange(e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={toId} className={labelClass}>Hasta</label>
        <Input
          id={toId}
          type="date"
          value={dateTo}
          onChange={(e) => onDateToChange(e.target.value)}
        />
      </div>
    </div>
  )
}
