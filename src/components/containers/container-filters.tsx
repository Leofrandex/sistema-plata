'use client'

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

export function ContainerFilters({ filters, clients, onChange }: Props) {
  return (
    <div className="flex flex-wrap gap-3">
      <Input
        placeholder="Buscar por número (ej: A-069)"
        value={filters.search}
        onChange={(e) => onChange({ ...filters, search: e.target.value })}
        className="w-56"
      />
      <Select
        value={filters.clientId}
        onValueChange={(v) => onChange({ ...filters, clientId: v ?? 'all' })}
      >
        <SelectTrigger className="w-52">
          <SelectValue placeholder="Todos los clientes" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos los clientes</SelectItem>
          {clients.map((c) => (
            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={String(filters.wasteType)}
        onValueChange={(v) => onChange({ ...filters, wasteType: (v ?? 'all') as WasteType | 'all' })}
      >
        <SelectTrigger className="w-52">
          <SelectValue placeholder="Tipo de desecho" />
        </SelectTrigger>
        <SelectContent>
          {WASTE_TYPE_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={String(filters.size)}
        onValueChange={(v) => onChange({ ...filters, size: (!v || v === 'all') ? 'all' : (Number(v) as ContainerSize) })}
      >
        <SelectTrigger className="w-40">
          <SelectValue placeholder="Tamaño" />
        </SelectTrigger>
        <SelectContent>
          {SIZE_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={String(opt.value)}>{opt.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
