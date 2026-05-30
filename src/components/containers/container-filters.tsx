'use client'

import { useId } from 'react'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { Company, ContainerSize } from '@/lib/types'

const SIZE_OPTIONS: { value: ContainerSize | 'all'; label: string }[] = [
  { value: 'all', label: 'Todos los tamaños' },
  { value: 240, label: '240 L' },
  { value: 750, label: '750 L' },
  { value: 1100, label: '1100 L' },
]

export interface ContainerFilters {
  search: string
  companyId: string
  size: ContainerSize | 'all'
}

interface Props {
  filters: ContainerFilters
  companies: Company[]
  onChange: (filters: ContainerFilters) => void
}

const labelClass = 'text-xs font-semibold uppercase tracking-wide text-muted-foreground'

export function ContainerFilters({ filters, companies, onChange }: Props) {
  const searchId = useId()
  const companyLabelId = useId()
  const sizeLabelId = useId()

  return (
    <div className="grid grid-cols-1 gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.4fr)_repeat(2,minmax(0,1fr))]">
      <div className="flex flex-col gap-1.5">
        <label htmlFor={searchId} className={labelClass}>Buscar tacho</label>
        <div className="relative">
          <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id={searchId}
            placeholder="Ej: I-001"
            value={filters.search}
            onChange={(e) => onChange({ ...filters, search: e.target.value })}
            className="pl-9"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <span id={companyLabelId} className={labelClass}>Empresa</span>
        <Select
          value={filters.companyId}
          onValueChange={(v) => onChange({ ...filters, companyId: v ?? 'all' })}
        >
          <SelectTrigger aria-labelledby={companyLabelId} className="w-full">
            <SelectValue placeholder="Todas las empresas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las empresas</SelectItem>
            {companies.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <span id={sizeLabelId} className={labelClass}>Tamaño</span>
        <Select
          value={String(filters.size)}
          onValueChange={(v) => onChange({ ...filters, size: (!v || v === 'all') ? 'all' : (Number(v) as ContainerSize) })}
        >
          <SelectTrigger aria-labelledby={sizeLabelId} className="w-full">
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
