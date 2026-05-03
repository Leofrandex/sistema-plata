'use client'

import { useState } from 'react'
import { StepIndicator } from '@/components/register/step-indicator'
import { ContainerSelector } from '@/components/register/container-selector'
import { SuccessScreen } from '@/components/register/success-screen'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useStore } from '@/lib/store'
import type { Container } from '@/lib/types'

const STEPS = ['Seleccionar envase', 'Confirmar inicio']
type Step = 1 | 2

export default function TreatmentPage() {
  const { containers, clients, addTreatmentRun } = useStore()
  const infectiousContainers = containers.filter((c) => c.waste_type === 'infectious')
  const [step, setStep] = useState<Step>(1)
  const [selected, setSelected] = useState<Container | null>(null)
  const [done, setDone] = useState(false)

  function handleSelect(container: Container) { setSelected(container); setStep(2) }

  function handleSubmit() {
    if (!selected) return
    addTreatmentRun({ id: `treatment-${Date.now()}`, container_id: selected.id, batch_id: 'batch-1', started_at: new Date().toISOString(), completed_at: null, operator_id: 'user-1' })
    setDone(true)
  }

  function reset() { setStep(1); setSelected(null); setDone(false) }

  if (done && selected) return <SuccessScreen title="Tratamiento iniciado" containerId={selected.id} onRegisterAnother={reset} />

  return (
    <div className="max-w-md mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-800">Iniciar Tratamiento</h1>
        <p className="text-sm text-slate-500 mt-1">Solo envases de desecho infeccioso (tipo 1)</p>
        <div className="mt-3"><StepIndicator current={step} total={2} labels={STEPS} /></div>
      </div>
      {step === 1 && <ContainerSelector containers={infectiousContainers} clients={clients} onSelect={handleSelect} />}
      {step === 2 && selected && (
        <div className="space-y-6">
          <Card className="border-yellow-200 bg-yellow-50">
            <CardContent className="pt-4">
              <p className="font-mono font-semibold text-yellow-800">{selected.id}</p>
              <p className="text-sm text-yellow-700">{clients.find((c) => c.id === selected.client_id)?.name} · Infeccioso</p>
              <p className="text-sm font-medium text-yellow-800 mt-2">
                ¿Confirmar inicio de tratamiento a las {new Date().toLocaleTimeString('es-PA', { hour: '2-digit', minute: '2-digit' })}?
              </p>
            </CardContent>
          </Card>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep(1)} className="flex-1">Atrás</Button>
            <Button onClick={handleSubmit} className="flex-1">Confirmar inicio</Button>
          </div>
        </div>
      )}
    </div>
  )
}
