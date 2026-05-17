'use client'

import { useState } from 'react'
import { StepIndicator } from '@/components/register/step-indicator'
import { ContainerSelector } from '@/components/register/container-selector'
import { PhotoCapture } from '@/components/register/photo-capture'
import { SuccessScreen } from '@/components/register/success-screen'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { useStore } from '@/lib/store'
import { computeNetWeight } from '@/lib/data/containers'
import type { Container } from '@/lib/types'

const STEPS = ['Seleccionar envase', 'Fotos', 'Peso']
type Step = 1 | 2 | 3

export default function WeighingPage() {
  const { containers, companies, addReception, addPhoto, addStorageEvent, addLocation } = useStore()

  const [step, setStep] = useState<Step>(1)
  const [selected, setSelected] = useState<Container | null>(null)
  const [photoContainer, setPhotoContainer] = useState<string | null>(null)
  const [photoScale, setPhotoScale] = useState<string | null>(null)
  const [grossWeight, setGrossWeight] = useState('')
  const [done, setDone] = useState(false)

  function handleSelect(container: Container) {
    setSelected(container)
    setStep(2)
  }

  function handlePhotosNext() {
    if (!photoContainer || !photoScale) return
    setStep(3)
  }

  function handleSubmit() {
    if (!selected || !photoContainer || !photoScale || !grossWeight) return

    const now = new Date().toISOString()
    const receptionId = `reception-${Date.now()}`
    const photo1Id = `photo-${Date.now()}-1`
    const photo2Id = `photo-${Date.now()}-2`
    const company = companies.find((c) => c.id === selected.company_id)
    const label = `PTDP ${company?.name ?? ''} ${new Date().toLocaleDateString('es-PA')} ${new Date().toLocaleTimeString('es-PA', { hour: '2-digit', minute: '2-digit' })}`

    addPhoto({ id: photo1Id, url: photoContainer, event_type: 'weighing', event_id: receptionId, taken_at: now, label })
    addPhoto({ id: photo2Id, url: photoScale, event_type: 'weighing', event_id: receptionId, taken_at: now, label })
    addReception({
      id: receptionId,
      container_id: selected.id,
      weighing_session_id: null,
      arrived_at: now,
      gross_weight_kg: parseFloat(grossWeight),
      operator_id: 'user-1',
      photo_ids: [photo1Id, photo2Id],
    })

    // Transición automática a cámara fría: tras el pesaje el envase queda
    // lógicamente en cámara fría sin paso manual ni foto.
    const storageId = `storage-${Date.now()}`
    addStorageEvent({
      id: storageId,
      container_id: selected.id,
      entry_at: now,
      exit_at: null,
      operator_id: 'user-1',
      photo_ids: [],
    })
    addLocation({
      id: `loc-${Date.now()}`,
      container_id: selected.id,
      reported_at: now,
      operator_id: 'user-1',
      location_type: 'cold_storage',
      client_id: null,
      floor: null,
      area: null,
      notes: null,
    })

    setDone(true)
  }

  function reset() {
    setStep(1); setSelected(null); setPhotoContainer(null); setPhotoScale(null); setGrossWeight(''); setDone(false)
  }

  if (done && selected) {
    return <SuccessScreen title="Pesaje registrado" containerId={selected.id} onRegisterAnother={reset} />
  }

  const selectedCompany = selected ? companies.find((c) => c.id === selected.company_id) : null

  return (
    <div className="max-w-md mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-800">Registrar Pesaje</h1>
        <p className="text-xs text-slate-500 mt-1">
          Flujo legacy. Reemplazado por sesiones multi-registro en la Fase 3.
        </p>
        <div className="mt-3"><StepIndicator current={step} total={3} labels={STEPS} /></div>
      </div>

      {step === 1 && <ContainerSelector containers={containers} companies={companies} onSelect={handleSelect} />}

      {step === 2 && selected && (
        <div className="space-y-6">
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="pt-4">
              <p className="font-mono font-semibold text-blue-800">{selected.id}</p>
              <p className="text-sm text-blue-600">
                {selectedCompany?.name ?? ''} · Tara: {selected.tare_weight_kg} kg
              </p>
            </CardContent>
          </Card>
          <PhotoCapture label="Foto del envase (número visible)" required preview={photoContainer} onCapture={setPhotoContainer} onRemove={() => setPhotoContainer(null)} />
          <PhotoCapture label="Foto de la balanza (peso visible)" required preview={photoScale} onCapture={setPhotoScale} onRemove={() => setPhotoScale(null)} />
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep(1)} className="flex-1">Atrás</Button>
            <Button onClick={handlePhotosNext} disabled={!photoContainer || !photoScale} className="flex-1">Continuar</Button>
          </div>
        </div>
      )}

      {step === 3 && selected && (
        <div className="space-y-6">
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="pt-4">
              <p className="font-mono font-semibold text-blue-800">{selected.id}</p>
              <p className="text-sm text-blue-600">Tara: {selected.tare_weight_kg} kg</p>
            </CardContent>
          </Card>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Peso bruto (kg) <span className="text-red-500">*</span></label>
            <Input type="number" step="0.1" min="0" value={grossWeight} onChange={(e) => setGrossWeight(e.target.value)} placeholder="Ej: 43.7" className="text-lg h-12" autoFocus />
            {grossWeight && parseFloat(grossWeight) > selected.tare_weight_kg && (
              <p className="text-sm text-slate-600">Peso neto estimado: <strong>{computeNetWeight(parseFloat(grossWeight), selected.tare_weight_kg)} kg</strong></p>
            )}
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep(2)} className="flex-1">Atrás</Button>
            <Button onClick={handleSubmit} disabled={!grossWeight || parseFloat(grossWeight) <= selected.tare_weight_kg} className="flex-1">Guardar</Button>
          </div>
        </div>
      )}
    </div>
  )
}
