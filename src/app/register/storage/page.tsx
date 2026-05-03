'use client'

import { useState } from 'react'
import { StepIndicator } from '@/components/register/step-indicator'
import { ContainerSelector } from '@/components/register/container-selector'
import { PhotoCapture } from '@/components/register/photo-capture'
import { SuccessScreen } from '@/components/register/success-screen'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useStore } from '@/lib/store'
import type { Container } from '@/lib/types'

const STEPS = ['Seleccionar envase', 'Foto']
type Step = 1 | 2

export default function StoragePage() {
  const { containers, clients, addStorageEvent, addPhoto, addLocation } = useStore()
  const [step, setStep] = useState<Step>(1)
  const [selected, setSelected] = useState<Container | null>(null)
  const [photo, setPhoto] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  function handleSelect(container: Container) { setSelected(container); setStep(2) }

  function handleSubmit() {
    if (!selected || !photo) return
    const now = new Date().toISOString()
    const eventId = `storage-${Date.now()}`
    const photoId = `photo-${Date.now()}`
    const clientName = clients.find((c) => c.id === selected.client_id)?.name ?? ''
    const label = `PTDP ${clientName} ${new Date().toLocaleDateString('es-PA')} ${new Date().toLocaleTimeString('es-PA', { hour: '2-digit', minute: '2-digit' })}`

    addPhoto({ id: photoId, url: photo, event_type: 'storage', event_id: eventId, taken_at: now, label })
    addStorageEvent({ id: eventId, container_id: selected.id, batch_id: 'batch-1', entry_at: now, exit_at: null, operator_id: 'user-1', photo_ids: [photoId] })
    addLocation({ id: `loc-${Date.now()}`, container_id: selected.id, reported_at: now, operator_id: 'user-1', location_type: 'cold_storage', client_id: null, floor: null, area: null, notes: null })
    setDone(true)
  }

  function reset() { setStep(1); setSelected(null); setPhoto(null); setDone(false) }

  if (done && selected) return <SuccessScreen title="Entrada a cámara fría registrada" containerId={selected.id} onRegisterAnother={reset} />

  return (
    <div className="max-w-md mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-800">Registrar Cámara Fría</h1>
        <div className="mt-3"><StepIndicator current={step} total={2} labels={STEPS} /></div>
      </div>
      {step === 1 && <ContainerSelector containers={containers} clients={clients} onSelect={handleSelect} />}
      {step === 2 && selected && (
        <div className="space-y-6">
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="pt-4">
              <p className="font-mono font-semibold text-blue-800">{selected.id}</p>
              <p className="text-sm text-blue-600">{clients.find((c) => c.id === selected.client_id)?.name}</p>
            </CardContent>
          </Card>
          <PhotoCapture label="Foto del envase en cámara fría" required preview={photo} onCapture={setPhoto} onRemove={() => setPhoto(null)} />
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep(1)} className="flex-1">Atrás</Button>
            <Button onClick={handleSubmit} disabled={!photo} className="flex-1">Guardar</Button>
          </div>
        </div>
      )}
    </div>
  )
}
