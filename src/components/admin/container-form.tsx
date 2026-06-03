'use client'

import { useState, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { Client, Company, Container, ContainerSize } from '@/lib/types'

const SIZE_OPTIONS: { value: ContainerSize; label: string }[] = [
  { value: 120, label: '120 L' },
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
  const [tare, setTare] = useState('')
  const [isYaris, setIsYaris] = useState(false)
  const [isMetallic, setIsMetallic] = useState(false)
  const [isYarisContainer, setIsYarisContainer] = useState(false)

  const companiesOfClient = useMemo(
    () => companies.filter((c) => c.client_id === clientId),
    [companies, clientId]
  )

  const selectedCompany = companies.find((c) => c.id === companyId)
  // Metálico o Yaris recorrido: id libre (M1… / Y1…) sin empresa. Normal: {letra}-NNN.
  const freeId = isMetallic || isYarisContainer
  const computedId = freeId
    ? containerNumber.trim()
    : selectedCompany && containerNumber
      ? `${selectedCompany.code_letter}-${containerNumber.padStart(3, '0')}`
      : ''

  function handleClientChange(newClientId: string) {
    setClientId(newClientId)
    setCompanyId('') // reset cascade
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!computedId || !size || !tare) return
    if (!freeId && (!clientId || !companyId)) return
    onSubmit({
      id: computedId,
      company_id: freeId ? '' : companyId,
      size_liters: size as ContainerSize,
      tare_weight_kg: parseFloat(tare),
      is_yaris_dedicated: isYaris,
      is_metallic_dedicated: isMetallic,
      is_yaris_container: isYarisContainer,
    })
  }

  const canSubmit = computedId && size && tare && (freeId || (clientId && companyId))

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
        <label className="text-sm font-medium">Número de tacho</label>
        <div className="flex gap-2 items-center">
          {selectedCompany && !freeId && (
            <span className="font-mono font-semibold text-slate-600">{selectedCompany.code_letter}-</span>
          )}
          <Input
            type={freeId ? 'text' : 'number'}
            placeholder={freeId ? (isYarisContainer ? 'Y1' : 'M1') : '001'}
            value={containerNumber}
            onChange={(e) => setContainerNumber(e.target.value)}
            className="flex-1"
          />
        </div>
        {computedId && (
          <p className="text-xs text-slate-500">ID del tacho: <strong className="font-mono">{computedId}</strong></p>
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

      <label className="flex items-start gap-3 rounded-lg border border-border bg-card p-3 cursor-pointer hover:bg-muted/30">
        <input
          type="checkbox"
          checked={isYaris}
          onChange={(e) => { setIsYaris(e.target.checked); if (e.target.checked) { setIsMetallic(false); setIsYarisContainer(false) } }}
          className="mt-0.5 h-4 w-4"
        />
        <div className="flex-1">
          <p className="text-sm font-medium">Tacho dedicado a Yaris</p>
          <p className="text-xs text-muted-foreground">
            Marcalo si este tacho se usa solo para pesaje de cargas Yaris/Picanto. Aparece en una lista aparte en el formulario de pesaje.
          </p>
        </div>
      </label>

      <label className="flex items-start gap-3 rounded-lg border border-border bg-card p-3 cursor-pointer hover:bg-muted/30">
        <input
          type="checkbox"
          checked={isMetallic}
          onChange={(e) => { setIsMetallic(e.target.checked); if (e.target.checked) { setIsYaris(false); setIsYarisContainer(false) } }}
          className="mt-0.5 h-4 w-4"
        />
        <div className="flex-1">
          <p className="text-sm font-medium">Tacho dedicado a metálico</p>
          <p className="text-xs text-muted-foreground">
            Marcalo si este tacho se usa solo para "Metálicos No reutilizables". Se crea sin empresa y aparece solo al pesar ese tipo.
          </p>
        </div>
      </label>

      <label className="flex items-start gap-3 rounded-lg border border-border bg-card p-3 cursor-pointer hover:bg-muted/30">
        <input
          type="checkbox"
          checked={isYarisContainer}
          onChange={(e) => { setIsYarisContainer(e.target.checked); if (e.target.checked) { setIsYaris(false); setIsMetallic(false) } }}
          className="mt-0.5 h-4 w-4"
        />
        <div className="flex-1">
          <p className="text-sm font-medium">Contenedor de flota Yaris</p>
          <p className="text-xs text-muted-foreground">
            Marcalo si es un contenedor físico de la flota Yaris (Y1…). Se crea sin empresa y sin tara, siempre disponible en recorrido y fuera de la cola de pesaje.
          </p>
        </div>
      </label>

      <div className="flex gap-3">
        <Button type="button" variant="outline" onClick={onCancel} className="flex-1">Cancelar</Button>
        <Button type="submit" className="flex-1" disabled={!canSubmit}>
          Agregar tacho
        </Button>
      </div>
    </form>
  )
}
