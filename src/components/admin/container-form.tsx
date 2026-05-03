'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { Client, Container, WasteType, ContainerSize } from '@/lib/types'

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
  onSubmit: (data: Omit<Container, 'registered_at' | 'status'>) => void
  onCancel: () => void
}

export function ContainerForm({ clients, onSubmit, onCancel }: Props) {
  const [clientId, setClientId] = useState('')
  const [containerNumber, setContainerNumber] = useState('')
  const [size, setSize] = useState<ContainerSize | ''>('')
  const [wasteType, setWasteType] = useState<WasteType | ''>('')
  const [tare, setTare] = useState('')

  const selectedClient = clients.find((c) => c.id === clientId)
  const computedId = selectedClient && containerNumber
    ? `${selectedClient.code_letter}-${containerNumber}`
    : ''

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!clientId || !containerNumber || !size || !wasteType || !tare) return
    onSubmit({
      id: computedId,
      client_id: clientId,
      size_liters: size as ContainerSize,
      waste_type: wasteType as WasteType,
      tare_weight_kg: parseFloat(tare),
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium">Cliente</label>
        <Select value={clientId} onValueChange={(v) => setClientId(v ?? '')}>
          <SelectTrigger><SelectValue placeholder="Seleccionar cliente" /></SelectTrigger>
          <SelectContent>
            {clients.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name} ({c.code_letter})</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium">Número de envase</label>
        <div className="flex gap-2 items-center">
          {selectedClient && (
            <span className="font-mono font-semibold text-slate-600">{selectedClient.code_letter}-</span>
          )}
          <Input type="number" placeholder="069" value={containerNumber} onChange={(e) => setContainerNumber(e.target.value)} className="flex-1" />
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
        <Input type="number" step="0.1" min="0" placeholder="14.2" value={tare} onChange={(e) => setTare(e.target.value)} />
      </div>
      <div className="flex gap-3">
        <Button type="button" variant="outline" onClick={onCancel} className="flex-1">Cancelar</Button>
        <Button type="submit" className="flex-1" disabled={!clientId || !containerNumber || !size || !wasteType || !tare}>
          Agregar envase
        </Button>
      </div>
    </form>
  )
}
