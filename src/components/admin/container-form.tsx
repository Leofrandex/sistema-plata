'use client'

import { useState, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { Client, Company, Container, WasteType, ContainerSize } from '@/lib/types'

const WASTE_OPTIONS: { value: WasteType; label: string }[] = [
  { value: 'infectious', label: 'Peligroso infeccioso' },
  { value: 'anatomopathological', label: 'Anatomopatológico' },
  { value: 'cytotoxic', label: 'Citotóxico' },
  { value: 'liquid', label: 'Líquidos' },
  { value: 'morgue', label: 'Morgue' },
]

const SIZE_OPTIONS: { value: ContainerSize; label: string }[] = [
  { value: 240, label: '240 L' },
  { value: 750, label: '750 L' },
  { value: 1100, label: '1100 L' },
]

interface Props {
  clients: Client[]
  companies: Company[]
  onSubmit: (data: Omit<Container, 'registered_at' | 'status'>) => void
  onCancel: () => void
}

export function ContainerForm({ clients, companies, onSubmit, onCancel }: Props) {
  const [clientId, setClientId] = useState('')
  const [companyId, setCompanyId] = useState('')
  const [containerNumber, setContainerNumber] = useState('')
  const [size, setSize] = useState<ContainerSize | ''>('')
  const [wasteType, setWasteType] = useState<WasteType | ''>('')
  const [tare, setTare] = useState('')

  const companiesOfClient = useMemo(
    () => companies.filter((c) => c.client_id === clientId),
    [companies, clientId]
  )

  const selectedCompany = companies.find((c) => c.id === companyId)
  const computedId = selectedCompany && containerNumber
    ? `${selectedCompany.code_letter}-${containerNumber.padStart(3, '0')}`
    : ''

  function handleClientChange(newClientId: string) {
    setClientId(newClientId)
    setCompanyId('') // reset cascade
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!clientId || !companyId || !containerNumber || !size || !wasteType || !tare) return
    onSubmit({
      id: computedId,
      company_id: companyId,
      size_liters: size as ContainerSize,
      waste_type: wasteType as WasteType,
      tare_weight_kg: parseFloat(tare),
    })
  }

  const canSubmit = clientId && companyId && containerNumber && size && wasteType && tare

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium">Cliente</label>
        <Select value={clientId} onValueChange={(v) => handleClientChange(v ?? '')}>
          <SelectTrigger><SelectValue placeholder="Seleccionar cliente" /></SelectTrigger>
          <SelectContent>
            {clients.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Empresa</label>
        <Select
          value={companyId}
          onValueChange={(v) => setCompanyId(v ?? '')}
          disabled={!clientId}
        >
          <SelectTrigger>
            <SelectValue placeholder={clientId ? 'Seleccionar empresa' : 'Primero elige un cliente'} />
          </SelectTrigger>
          <SelectContent>
            {companiesOfClient.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name} ({c.code_letter})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Número de envase</label>
        <div className="flex gap-2 items-center">
          {selectedCompany && (
            <span className="font-mono font-semibold text-slate-600">{selectedCompany.code_letter}-</span>
          )}
          <Input
            type="number"
            placeholder="001"
            value={containerNumber}
            onChange={(e) => setContainerNumber(e.target.value)}
            className="flex-1"
          />
        </div>
        {computedId && (
          <p className="text-xs text-slate-500">ID del envase: <strong className="font-mono">{computedId}</strong></p>
        )}
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Tamaño</label>
        <Select value={String(size)} onValueChange={(v) => setSize((v ? Number(v) : '') as ContainerSize | '')}>
          <SelectTrigger><SelectValue placeholder="Seleccionar tamaño" /></SelectTrigger>
          <SelectContent>
            {SIZE_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={String(o.value)}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Tipo de desecho</label>
        <Select value={wasteType} onValueChange={(v) => setWasteType((v ?? '') as WasteType)}>
          <SelectTrigger><SelectValue placeholder="Seleccionar tipo" /></SelectTrigger>
          <SelectContent>
            {WASTE_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Tara (kg)</label>
        <Input
          type="number"
          step="0.1"
          min="0"
          placeholder="14.2"
          value={tare}
          onChange={(e) => setTare(e.target.value)}
        />
      </div>

      <div className="flex gap-3">
        <Button type="button" variant="outline" onClick={onCancel} className="flex-1">Cancelar</Button>
        <Button type="submit" className="flex-1" disabled={!canSubmit}>
          Agregar envase
        </Button>
      </div>
    </form>
  )
}
