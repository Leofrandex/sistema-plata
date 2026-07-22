'use client'

import { useId } from 'react'
import { Search } from 'lucide-react'
import { Input } from '@hospiwaste/shared/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@hospiwaste/shared/components/ui/select'
import { circulationLabel } from '@hospiwaste/shared/lib/data/dashboard-metrics'
import type { CirculationBucket } from '@hospiwaste/shared/lib/data/dashboard-metrics'
import type { ContainerSize } from '@hospiwaste/shared/lib/types'

const SIZE_OPTIONS: { value: ContainerSize | 'all'; label: string }[] = [
  { value: 'all', label: 'Todos los tamaños' },
  { value: 240, label: '240 L' },
  { value: 750, label: '750 L' },
  { value: 1100, label: '1100 L' },
]

const PHASE_OPTIONS: { value: CirculationBucket; label: string }[] = [
  { value: 'en_planta', label: circulationLabel('en_planta') },
  { value: 'en_cliente', label: circulationLabel('en_cliente') },
  { value: 'pendiente_pesar', label: circulationLabel('pendiente_pesar') },
  { value: 'pendiente_tratar', label: circulationLabel('pendiente_tratar') },
]

export interface ContainerFilters {
  search: string
  size: ContainerSize | 'all'
  company: string | 'all'
  phase: CirculationBucket | 'all'
}

interface Props {
  filters: ContainerFilters
  onChange: (filters: ContainerFilters) => void
  companies: { id: string; name: string }[]
}

const labelClass = 'text-xs font-semibold uppercase tracking-wide text-muted-foreground'

export function ContainerFilters({ filters, onChange, companies }: Props) {
  const searchId = useId()
  const sizeLabelId = useId()
  const companyLabelId = useId()
  const phaseLabelId = useId()

  return (
    <div className="grid grid-cols-1 gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10 sm:grid-cols-2 lg:grid-cols-4">
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

      <div className="flex flex-col gap-1.5">
        <span id={companyLabelId} className={labelClass}>Empresa</span>
        <Select
          value={filters.company}
          onValueChange={(v) => onChange({ ...filters, company: (!v ? 'all' : v) })}
        >
          <SelectTrigger aria-labelledby={companyLabelId} className="w-full">
            <SelectValue placeholder="Empresa" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las empresas</SelectItem>
            {companies.map((co) => (
              <SelectItem key={co.id} value={co.id}>{co.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <span id={phaseLabelId} className={labelClass}>Fase</span>
        <Select
          value={filters.phase}
          onValueChange={(v) => onChange({ ...filters, phase: (!v ? 'all' : (v as CirculationBucket)) })}
        >
          <SelectTrigger aria-labelledby={phaseLabelId} className="w-full">
            <SelectValue placeholder="Fase" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las fases</SelectItem>
            {PHASE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
