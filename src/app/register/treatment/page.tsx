'use client'

import { useState, useMemo } from 'react'
import { CheckCircle2, Circle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useStore } from '@/lib/store'
import {
  computeContainerPhase,
  getRouteEventIdsForContainer,
  formatTachoNumber,
} from '@/lib/data/containers'
import { createClient } from '@/lib/supabase/client'
import * as q from '@/lib/supabase/queries'

export default function TreatmentPage() {
  const {
    containers,
    receptions,
    storageEvents,
    treatmentRuns,
    externalTransfers,
    routeEvents,
    currentProfileId,
    addTreatmentRun,
    addLocation,
  } = useStore()

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [done, setDone] = useState(false)
  const [submittedCount, setSubmittedCount] = useState(0)

  // Memoized list of candidates: active containers in cold_storage with infectious waste_type
  const candidates = useMemo(() => {
    return containers.filter((c) => {
      if (c.status !== 'active') return false
      const routeIds = getRouteEventIdsForContainer(routeEvents, c.id)
      const reception = [...receptions]
        .filter((r) => r.container_id === c.id && !r.voided_at)
        .sort((a, b) => new Date(b.arrived_at).getTime() - new Date(a.arrived_at).getTime())[0] ?? null
      if (!reception || reception.waste_type !== 'infectious') return false
      const storage = [...storageEvents]
        .filter((s) => s.container_id === c.id)
        .sort((a, b) => new Date(b.entry_at).getTime() - new Date(a.entry_at).getTime())[0] ?? null
      const treatment =
        treatmentRuns.find((t) => t.container_id === c.id && !t.completed_at) ??
        externalTransfers.find((t) => t.container_id === c.id && !t.transferred_at) ??
        null
      const phase = computeContainerPhase(routeIds, reception, storage, treatment)
      return phase === 'cold_storage'
    })
  }, [containers, receptions, storageEvents, treatmentRuns, externalTransfers, routeEvents])

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
    if (!currentProfileId || selectedIds.size === 0) return
    const now = new Date().toISOString()
    const supabase = createClient()
    for (const id of selectedIds) {
      try {
        const tr = await q.createTreatmentRun(supabase, {
          container_id: id,
          started_at: now,
          completed_at: now,
          operator_id: currentProfileId,
        })
        addTreatmentRun({
          id: tr.id,
          container_id: id,
          started_at: now,
          completed_at: now,
          operator_id: currentProfileId,
        })
        addLocation({
          id: `loc-${Date.now()}-${id}`,
          container_id: id,
          reported_at: now,
          operator_id: currentProfileId,
          location_type: 'treatment',
          client_id: null,
          floor: null,
          area: null,
          notes: 'Tratamiento',
        })
      } catch (err) {
        console.error('[tratamiento] falló:', err)
      }
    }
    setSubmittedCount(selectedIds.size)
    setDone(true)
  }

  function reset() {
    setSelectedIds(new Set())
    setDone(false)
    setSubmittedCount(0)
  }

  if (done) {
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
          {candidates.map((c) => {
            const isSelected = selectedIds.has(c.id)
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => toggleSelect(c.id)}
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
                    {formatTachoNumber(c.id)}
                  </span>
                </div>
                <Badge variant="secondary">{c.size_liters} L</Badge>
              </button>
            )
          })}
        </div>
      )}

      <Button
        onClick={handleSubmit}
        disabled={selectedIds.size === 0 || !currentProfileId}
        className="w-full"
      >
        Enviar {selectedIds.size > 0 ? selectedIds.size : ''} a tratamiento
      </Button>
    </div>
  )
}
