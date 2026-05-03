'use client'

import { useState } from 'react'
import { StepIndicator } from '@/components/register/step-indicator'
import { ContainerSelector } from '@/components/register/container-selector'
import { SuccessScreen } from '@/components/register/success-screen'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
import { useStore } from '@/lib/store'
import type { Container, LocationType } from '@/lib/types'

const STEPS = ['Seleccionar envase', 'Registrar ubicación']

const LOCATION_TYPE_OPTIONS: { value: LocationType; label: string }[] = [
  { value: 'client_site', label: 'Instalación del cliente' },
  { value: 'plant_storage', label: 'Planta — almacén' },
  { value: 'cold_storage', label: 'Planta — cámara fría' },
  { value: 'treatment', label: 'Planta — tratamiento' },
]

type Step = 1 | 2

export default function LocationPage() {
  const { containers, clients, addLocation } = useStore()
  const [step, setStep] = useState<Step>(1)
  const [selected, setSelected] = useState<Container | null>(null)
  const [locationType, setLocationType] = useState<LocationType>('client_site')
  const [clientId, setClientId] = useState('')
  const [floor, setFloor] = useState('')
  const [area, setArea] = useState('')
  const [notes, setNotes] = useState('')
  const [done, setDone] = useState(false)

  function handleSelect(container: Container) {
    setSelected(container)
    setClientId(container.client_id)
    setStep(2)
  }

  function handleSubmit() {
    if (!selected) return
    addLocation({
      id: `loc-${Date.now()}`,
      container_id: selected.id,
      reported_at: new Date().toISOString(),
      operator_id: 'user-1',
      location_type: locationType,
      client_id: locationType === 'client_site' ? clientId || null : null,
      floor: floor || null,
      area: area || null,
      notes: notes || null,
    })
    setDone(true)
  }

  function reset() {
    setStep(1); setSelected(null); setLocationType('client_site'); setClientId(''); setFloor(''); setArea(''); setNotes(''); setDone(false)
  }

  if (done && selected) return <SuccessScreen title="Ubicación registrada" containerId={selected.id} onRegisterAnother={reset} />

  return (
    <div className="max-w-md mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-800">Reportar Ubicación</h1>
        <div className="mt-3"><StepIndicator current={step} total={2} labels={STEPS} /></div>
      </div>
      {step === 1 && <ContainerSelector containers={containers} clients={clients} onSelect={handleSelect} />}
      {step === 2 && selected && (
        <div className="space-y-4">
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="pt-4">
              <p className="font-mono font-semibold text-blue-800">{selected.id}</p>
            </CardContent>
          </Card>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Tipo de ubicación</label>
            <Select value={locationType} onValueChange={(v) => setLocationType((v ?? 'client_site') as LocationType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {LOCATION_TYPE_OPTIONS.map((opt) => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {locationType === 'client_site' && (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Cliente</label>
                <Select value={clientId} onValueChange={(v) => setClientId(v ?? '')}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar cliente" /></SelectTrigger>
                  <SelectContent>
                    {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Input placeholder="Piso (ej: 2)" value={floor} onChange={(e) => setFloor(e.target.value)} />
              <Input placeholder="Área / sala (ej: Pediatría)" value={area} onChange={(e) => setArea(e.target.value)} />
            </>
          )}
          <Input placeholder="Notas (opcional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep(1)} className="flex-1">Atrás</Button>
            <Button onClick={handleSubmit} className="flex-1">Guardar ubicación</Button>
          </div>
        </div>
      )}
    </div>
  )
}
