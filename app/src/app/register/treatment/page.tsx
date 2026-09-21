'use client'

import { useState, useMemo } from 'react'
import { CheckCircle2, Circle } from 'lucide-react'
import { Button } from '@hospiwaste/shared/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@hospiwaste/shared/components/ui/card'
import { Badge } from '@hospiwaste/shared/components/ui/badge'
import { useStore } from '@hospiwaste/shared/lib/store'
import { formatTachoNumber } from '@hospiwaste/shared/lib/data/containers'
import { formatDuration } from '@hospiwaste/shared/lib/data/dashboard-metrics'
import {
  listTreatmentCandidates,
  type TreatmentCandidate,
} from '@hospiwaste/shared/lib/data/treatment'
import { treatContainers } from '@/lib/data/treat-containers'

export default function TreatmentPage() {
  const {
    containers,
    receptions,
    storageEvents,
    treatmentRuns,
    externalTransfers,
    currentProfileId,
    addTreatmentRun,
    updateStorageEvent,
    addLocation,
  } = useStore()

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [step, setStep] = useState<'select' | 'confirm' | 'done'>('select')
  const [submitting, setSubmitting] = useState(false)
  const [submittedCount, setSubmittedCount] = useState(0)

  const candidates = useMemo(
    () => listTreatmentCandidates(
      { containers, receptions, storageEvents, treatmentRuns, externalTransfers },
      Date.now(),
    ),
    [containers, receptions, storageEvents, treatmentRuns, externalTransfers],
  )

  const selectedCandidates = useMemo<TreatmentCandidate[]>(
    () => candidates.filter((c) => selectedIds.has(c.container.id)),
    [candidates, selectedIds],
  )

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  async function handleSubmit() {
    if (!currentProfileId || selectedCandidates.length === 0 || submitting) return
    setSubmitting(true)
    const res = await treatContainers(
      selectedCandidates,
      currentProfileId,
      new Date().toISOString(),
      { addTreatmentRun, updateStorageEvent, addLocation },
    )
    if (res.failedAt) {
      console.error('[tratamiento] se cortó en', res.failedAt, res.error)
    }
    setSubmittedCount(res.treated)
    setSubmitting(false)
    setStep('done')
  }

  function reset() {
    setSelectedIds(new Set())
    setStep('select')
    setSubmittedCount(0)
  }

  if (step === 'done') {
    return (
      <div className="max-w-md mx-auto space-y-6">
        <Card className="border-green-200 bg-green-50">
          <CardHeader>
            <CardTitle className="text-green-800">Tratamiento registrado</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-green-700">
              {submittedCount} tacho{submittedCount !== 1 ? 's' : ''} enviado{submittedCount !== 1 ? 's' : ''} a tratamiento correctamente.
            </p>
            <Button variant="outline" onClick={reset}>
              Volver
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (step === 'confirm') {
    const numbers = selectedCandidates.map((c) => formatTachoNumber(c.container.id))
    return (
      <div className="max-w-md mx-auto space-y-6">
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader>
            <CardTitle className="text-amber-900">Confirmar envío a tratamiento</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-amber-800">
              ¿Seguro que quieres enviar a tratamiento {numbers.length} tacho
              {numbers.length !== 1 ? 's' : ''}? Esta acción cierra su ciclo.
            </p>
            <div className="flex flex-wrap gap-2">
              {numbers.map((n) => (
                <Badge key={n} variant="secondary" className="font-mono">
                  {n}
                </Badge>
              ))}
            </div>
            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setStep('select')}
                disabled={submitting}
              >
                Cancelar
              </Button>
              <Button
                className="flex-1"
                onClick={handleSubmit}
                disabled={submitting || numbers.length === 0}
              >
                {submitting ? 'Enviando…' : 'Confirmar'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-800">Enviar tachos a tratamiento</h1>
        <p className="text-sm text-slate-500 mt-1">Solo tachos infecciosos en cámara fría</p>
      </div>

      {candidates.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground text-center">
              No hay tachos infecciosos en cámara fría.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {candidates.map((cand) => {
            const isSelected = selectedIds.has(cand.container.id)
            return (
              <button
                key={cand.container.id}
                type="button"
                onClick={() => toggleSelect(cand.container.id)}
                className={`w-full text-left rounded-lg border px-4 py-3 flex items-center justify-between gap-3 transition-colors ${
                  isSelected
                    ? 'border-blue-400 bg-blue-50'
                    : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  {isSelected ? (
                    <CheckCircle2 className="h-5 w-5 text-blue-600 shrink-0" />
                  ) : (
                    <Circle className="h-5 w-5 text-slate-300 shrink-0" />
                  )}
                  <span className="font-mono font-semibold text-slate-800">
                    {formatTachoNumber(cand.container.id)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs tabular-nums text-slate-500">
                    {formatDuration(cand.coldStorageSinceMs)} en cámara
                  </span>
                  <Badge variant="secondary">{cand.container.size_liters} L</Badge>
                </div>
              </button>
            )
          })}
        </div>
      )}

      <Button
        onClick={() => setStep('confirm')}
        disabled={selectedIds.size === 0 || !currentProfileId}
        className="w-full"
      >
        Enviar {selectedIds.size > 0 ? selectedIds.size : ''} a tratamiento
      </Button>
    </div>
  )
}
