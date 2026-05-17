'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { StepIndicator } from '@/components/register/step-indicator'
import { ContainerSelector } from '@/components/register/container-selector'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useStore } from '@/lib/store'
import type { Container } from '@/lib/types'

const STEPS = ['Seleccionar envases', 'Destino']
type Step = 1 | 2

export default function TransferPage() {
  const { containers, clients, addExternalTransfer } = useStore()
  const nonInfectiousContainers = containers.filter((c) => c.waste_type !== 'infectious')
  const [step, setStep] = useState<Step>(1)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [destination, setDestination] = useState('')
  const [done, setDone] = useState(false)

  function handleContainerSelect(container: Container) {
    if (!selectedIds.includes(container.id)) setSelectedIds((prev) => [...prev, container.id])
  }

  function removeContainer(id: string) {
    setSelectedIds((prev) => prev.filter((cid) => cid !== id))
  }

  function handleSubmit() {
    if (selectedIds.length === 0 || !destination.trim()) return
    const now = new Date().toISOString()
    const dest = destination.trim()
    selectedIds.forEach((cid) => {
      addExternalTransfer({
        id: `transfer-${Date.now()}-${cid}`,
        container_id: cid,
        batch_id: 'batch-1',
        storage_started_at: now,
        transferred_at: null,
        destination: dest,
        operator_id: 'user-1',
      })
    })
    setDone(true)
  }

  function reset() { setStep(1); setSelectedIds([]); setDestination(''); setDone(false) }

  if (done) {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-4 text-center">
        <div className="text-5xl">✓</div>
        <h2 className="text-xl font-semibold">Traslado registrado</h2>
        <p className="text-slate-500">{selectedIds.length} envase{selectedIds.length !== 1 ? 's' : ''} registrado{selectedIds.length !== 1 ? 's' : ''}.</p>
        <Button onClick={reset}>Registrar otro traslado</Button>
      </div>
    )
  }

  const selectedContainers = containers.filter((c) => selectedIds.includes(c.id))

  return (
    <div className="max-w-md mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-800">Registrar Traslado Externo</h1>
        <p className="text-sm text-slate-500 mt-1">Tipos 2–5 (anatomopatológico, citotóxico, líquidos, morgue)</p>
        <div className="mt-3"><StepIndicator current={step} total={2} labels={STEPS} /></div>
      </div>

      {step === 1 && (
        <div className="space-y-4">
          <ContainerSelector containers={nonInfectiousContainers} clients={clients} onSelect={handleContainerSelect} />
          {selectedIds.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-slate-600">Envases seleccionados:</p>
              <div className="flex flex-wrap gap-2">
                {selectedContainers.map((c) => (
                  <Badge key={c.id} variant="secondary" className="gap-1">
                    <span className="font-mono">{c.id}</span>
                    <button onClick={() => removeContainer(c.id)}><X className="h-3 w-3" /></button>
                  </Badge>
                ))}
              </div>
              <Button onClick={() => setStep(2)} className="w-full mt-2">
                Continuar con {selectedIds.length} envase{selectedIds.length !== 1 ? 's' : ''}
              </Button>
            </div>
          )}
        </div>
      )}

      {step === 2 && selectedIds.length > 0 && (
        <div className="space-y-6">
          <div className="rounded-lg border bg-blue-50 border-blue-200 p-4 space-y-2">
            <p className="text-sm font-medium text-blue-700">
              {selectedIds.length} envase{selectedIds.length !== 1 ? 's' : ''} a trasladar
            </p>
            <div className="flex flex-wrap gap-1.5">
              {selectedContainers.map((c) => (
                <Badge key={c.id} variant="outline" className="font-mono bg-white">{c.id}</Badge>
              ))}
            </div>
          </div>
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
