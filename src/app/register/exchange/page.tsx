'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { StepIndicator } from '@/components/register/step-indicator'
import { ContainerSelector } from '@/components/register/container-selector'
import { PhotoCapture } from '@/components/register/photo-capture'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useStore } from '@/lib/store'
import type { Container } from '@/lib/types'

const STEPS = ['Seleccionar envases', 'Ubicación + fotos']
type Step = 1 | 2

export default function ExchangePage() {
  const { containers, clients, addExchangeEvent, addLocation, addPhoto } = useStore()

  const [step, setStep] = useState<Step>(1)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [location, setLocation] = useState('')
  const [clientSiteId, setClientSiteId] = useState('')
  const [floor, setFloor] = useState('')
  const [area, setArea] = useState('')
  const [photoClean, setPhotoClean] = useState<string | null>(null)
  const [photoDirty, setPhotoDirty] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  function handleContainerSelect(container: Container) {
    if (!selectedIds.includes(container.id)) setSelectedIds((prev) => [...prev, container.id])
  }

  function removeContainer(id: string) {
    setSelectedIds((prev) => prev.filter((cid) => cid !== id))
  }

  function handleSubmit() {
    if (!photoClean || !photoDirty || selectedIds.length === 0) return
    const now = new Date().toISOString()
    const eventId = `exchange-${Date.now()}`
    const photo1Id = `photo-${Date.now()}-clean`
    const photo2Id = `photo-${Date.now()}-dirty`
    const firstClient = clients.find((c) => c.id === containers.find((ct) => ct.id === selectedIds[0])?.client_id)
    const clientName = firstClient?.name ?? ''
    const label = `PTDP ${clientName} ${new Date().toLocaleDateString('es-PA')} ${new Date().toLocaleTimeString('es-PA', { hour: '2-digit', minute: '2-digit' })}`

    addPhoto({ id: photo1Id, url: photoClean, event_type: 'exchange', event_id: eventId, taken_at: now, label })
    addPhoto({ id: photo2Id, url: photoDirty, event_type: 'exchange', event_id: eventId, taken_at: now, label })

    addExchangeEvent({
      id: eventId,
      batch_id: 'batch-1',
      timestamp: now,
      operator_id: 'user-1',
      clean_containers_given: selectedIds,
      dirty_containers_received: selectedIds,
      location: location || 'No especificado',
      photo_ids: [photo1Id, photo2Id],
    })

    selectedIds.forEach((cid, idx) => {
      addLocation({
        id: `loc-${Date.now()}-${idx}`,
        container_id: cid,
        reported_at: now,
        operator_id: 'user-1',
        location_type: clientSiteId ? 'client_site' : 'plant_storage',
        client_id: clientSiteId || null,
        floor: floor || null,
        area: area || null,
        notes: location || null,
      })
    })
    setDone(true)
  }

  function reset() {
    setStep(1); setSelectedIds([]); setLocation(''); setClientSiteId(''); setFloor(''); setArea(''); setPhotoClean(null); setPhotoDirty(null); setDone(false)
  }

  if (done) {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-4 text-center">
        <div className="text-5xl">✓</div>
        <h2 className="text-xl font-semibold">Intercambio registrado</h2>
        <p className="text-slate-500">{selectedIds.length} envases registrados.</p>
        <Button onClick={reset}>Registrar otro intercambio</Button>
      </div>
    )
  }

  const selectedContainers = containers.filter((c) => selectedIds.includes(c.id))

  return (
    <div className="max-w-md mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-800">Registrar Intercambio</h1>
        <div className="mt-3"><StepIndicator current={step} total={2} labels={STEPS} /></div>
      </div>

      {step === 1 && (
        <div className="space-y-4">
          <ContainerSelector containers={containers} clients={clients} onSelect={handleContainerSelect} />
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

      {step === 2 && (
        <div className="space-y-6">
          <div className="space-y-3">
            <p className="text-sm font-semibold text-slate-700">Ubicación donde quedan los envases</p>
            <Select value={clientSiteId} onValueChange={(v) => setClientSiteId(v ?? '')}>
              <SelectTrigger><SelectValue placeholder="Cliente / instalación" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">— Sin asignar a cliente —</SelectItem>
                {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            {clientSiteId && (
              <>
                <Input placeholder="Piso (ej: 2)" value={floor} onChange={(e) => setFloor(e.target.value)} />
                <Input placeholder="Área / sala (ej: Pediatría)" value={area} onChange={(e) => setArea(e.target.value)} />
              </>
            )}
            <Input placeholder="Punto de encuentro o notas (opcional)" value={location} onChange={(e) => setLocation(e.target.value)} />
          </div>
          <PhotoCapture label="Foto de envases limpios entregados" required preview={photoClean} onCapture={setPhotoClean} onRemove={() => setPhotoClean(null)} />
          <PhotoCapture label="Foto de envases sucios recibidos" required preview={photoDirty} onCapture={setPhotoDirty} onRemove={() => setPhotoDirty(null)} />
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep(1)} className="flex-1">Atrás</Button>
            <Button onClick={handleSubmit} disabled={!photoClean || !photoDirty} className="flex-1">Guardar</Button>
          </div>
        </div>
      )}
    </div>
  )
}
