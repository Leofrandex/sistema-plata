'use client'

import { useState } from 'react'
import { StepIndicator } from '@/components/register/step-indicator'
import { ContainerSelector } from '@/components/register/container-selector'
import { SuccessScreen } from '@/components/register/success-screen'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { useStore } from '@/lib/store'
import type { Container } from '@/lib/types'

const STEPS = ['Seleccionar envase', 'Destino']
type Step = 1 | 2

export default function TransferPage() {
  const { containers, clients, addExternalTransfer } = useStore()
  const nonInfectiousContainers = containers.filter((c) => c.waste_type !== 'infectious')
  const [step, setStep] = useState<Step>(1)
  const [selected, setSelected] = useState<Container | null>(null)
  const [destination, setDestination] = useState('')
  const [done, setDone] = useState(false)

  function handleSelect(container: Container) { setSelected(container); setStep(2) }

  function handleSubmit() {
    if (!selected || !destination.trim()) return
    addExternalTransfer({ id: `transfer-${Date.now()}`, container_id: selected.id, batch_id: 'batch-1', storage_started_at: new Date().toISOString(), transferred_at: null, destination: destination.trim(), operator_id: 'user-1' })
    setDone(true)
  }

  function reset() { setStep(1); setSelected(null); setDestination(''); setDone(false) }

  if (done && selected) return <SuccessScreen title="Traslado registrado" containerId={selected.id} onRegisterAnother={reset} />

  return (
    <div className="max-w-md mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-800">Registrar Traslado Externo</h1>
        <p className="text-sm text-slate-500 mt-1">Tipos 2–5 (anatomopatológico, citotóxico, líquidos, morgue)</p>
        <div className="mt-3"><StepIndicator current={step} total={2} labels={STEPS} /></div>
      </div>
      {step === 1 && <ContainerSelector containers={nonInfectiousContainers} clients={clients} onSelect={handleSelect} />}
      {step === 2 && selected && (
        <div className="space-y-6">
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="pt-4">
              <p className="font-mono font-semibold text-blue-800">{selected.id}</p>
              <p className="text-sm text-blue-600">{clients.find((c) => c.id === selected.client_id)?.name}</p>
            </CardContent>
          </Card>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Centro externo de destino <span className="text-red-500">*</span></label>
            <Input value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="Nombre del centro externo" className="h-12" autoFocus />
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep(1)} className="flex-1">Atrás</Button>
            <Button onClick={handleSubmit} disabled={!destination.trim()} className="flex-1">Guardar</Button>
          </div>
        </div>
      )}
    </div>
  )
}
