'use client'

import { useId } from 'react'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { Client, WasteType, ContainerSize } from '@/lib/types'

const WASTE_TYPE_OPTIONS: { value: WasteType | 'all'; label: string }[] = [
  { value: 'all', label: 'Todos los tipos' },
  { value: 'infectious', label: 'Infeccioso' },
  { value: 'anatomopathological', label: 'Anatomopatológico' },
  { value: 'cytotoxic', label: 'Citotóxico' },
  { value: 'liquid', label: 'Líquidos' },
  { value: 'morgue', label: 'Morgue' },
]

const SIZE_OPTIONS: { value: ContainerSize | 'all'; label: string }[] = [
  { value: 'all', label: 'Todos los tamaños' },
  { value: 240, label: '240 L' },
  { value: 750, label: '750 L' },
  { value: 1100, label: '1100 L' },
]

export interface ContainerFilters {
  search: string
  clientId: string
  wasteType: WasteType | 'all'
  size: ContainerSize | 'all'
}

interface Props {
  filters: ContainerFilters
  clients: Client[]
  onChange: (filters: ContainerFilters) => void
}

const labelClass = 'text-xs font-semibold uppercase tracking-wide text-muted-foreground'

export function ContainerFilters({ filters, clients, onChange }: Props) {
  const searchId = useId()

  return (
    <div className="grid grid-cols-1 gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))]">
      <div className="flex flex-col gap-1.5">
        <label htmlFor={searchId} className={labelClass}>Buscar envase</label>
        <div className="relative">
          <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id={searchId}
            placeholder="Ej: A-069"
            value={filters.search}
            onChange={(e) => onChange({ ...filters, search: e.target.value })}
            className="pl-9"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className={labelClass}>Cliente</span>
        <Select
          value={filters.clientId}
          onValueChange={(v) => onChange({ ...filters, clientId: v ?? 'all' })}
        >
          <SelectTrigger className="w-full">
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
        <span className={labelClass}>Tipo de desecho</span>
        <Select
          value={String(filters.wasteType)}
          onValueChange={(v) => onChange({ ...filters, wasteType: (v ?? 'all') as WasteType | 'all' })}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Tipo de desecho" />
          </SelectTrigger>
          <SelectContent>
            {WASTE_TYPE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className={labelClass}>Tamaño</span>
        <Select
          value={String(filters.size)}
          onValueChange={(v) => onChange({ ...filters, size: (!v || v === 'all') ? 'all' : (Number(v) as ContainerSize) })}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Tamaño" />
          </SelectTrigger>
          <SelectContent>
            {SIZE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={String(opt.value)}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
