'use client'

import { useMemo, useState } from 'react'
import { Ban, X } from 'lucide-react'
import { useStore } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { ConfirmVoidDialog } from '@/components/ui/confirm-void-dialog'
import { formatTachoNumber, computeNetWeight } from '@/lib/data/containers'
import { createClient } from '@/lib/supabase/client'
import * as q from '@/lib/supabase/queries'
import type { ContainerReception, WasteType } from '@/lib/types'

const WASTE_TYPES: { value: WasteType; label: string }[] = [
  { value: 'infectious', label: 'Infeccioso' },
  { value: 'anatomopathological', label: 'Anatomopatológico' },
  { value: 'cytotoxic', label: 'Citotóxico' },
  { value: 'liquid', label: 'Líquidos' },
  { value: 'morgue', label: 'Morgue' },
  { value: 'metallic', label: 'Metálicos' },
]

export function WeighingHistory() {
  const {
    weighingSessions, receptions, containers, currentProfileId, currentRole,
    updateReception, voidWeighingSession,
  } = useStore()
  const isCoordinator = currentRole === 'coordinator'

  const [openId, setOpenId] = useState<string | null>(null)
  const [voiding, setVoiding] = useState<{ kind: 'reception' | 'session'; id: string } | null>(null)

  const sorted = useMemo(
    () => [...weighingSessions].sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime()),
    [weighingSessions],
  )

  async function saveField(rec: ContainerReception, patch: Partial<ContainerReception>) {
    try {
      await q.updateReception(createClient(), rec.id, patch)
    } catch (err) { console.error('[historial pesaje] editar falló:', err); return }
    updateReception(rec.id, patch)
  }

  async function voidReception(rec: ContainerReception, reason: string) {
    if (!currentProfileId) return
    try {
      await q.voidReception(createClient(), rec.id, currentProfileId, reason)
    } catch (err) { console.error('[historial pesaje] anular recepción falló:', err); return }
    updateReception(rec.id, { voided_at: new Date().toISOString(), voided_by: currentProfileId, void_reason: reason })
    setVoiding(null)
  }

  async function voidSession(sessionId: string, reason: string) {
    if (!currentProfileId) return
    try {
      await q.voidWeighingSession(createClient(), sessionId, currentProfileId, reason)
    } catch (err) { console.error('[historial pesaje] anular sesión falló:', err); return }
    voidWeighingSession(sessionId, currentProfileId, reason)
    setVoiding(null)
    setOpenId(null)
  }

  if (sorted.length === 0) {
    return <p className="text-sm text-muted-foreground py-8 text-center">Sin sesiones de pesaje.</p>
  }

  return (
    <div className="space-y-3">
      {sorted.map((s) => {
        const recs = receptions.filter((r) => s.reception_ids.includes(r.id))
        const live = recs.filter((r) => !r.voided_at)
        const isOpen = openId === s.id
        return (
          <div key={s.id} className={s.voided_at ? 'rounded-lg border border-border bg-muted/40 p-4 opacity-70' : 'rounded-lg border border-border bg-card p-4'}>
            <button type="button" className="w-full text-left" onClick={() => setOpenId(isOpen ? null : s.id)}>
              <p className="text-sm font-semibold text-foreground">
                {s.date} · {live.length} tacho{live.length !== 1 ? 's' : ''}
                {s.voided_at && <span className="ml-2 rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-700">ANULADA</span>}
              </p>
            </button>

            {isOpen && (
              <div className="mt-3 space-y-2 border-t border-border pt-3">
                {recs.map((r) => {
                  const cont = containers.find((c) => c.id === r.container_id)
                  const net = cont ? computeNetWeight(r.gross_weight_kg, cont.tare_weight_kg) : null
                  return (
                    <div key={r.id} className={r.voided_at ? 'rounded-md bg-muted/40 p-2 text-xs opacity-60' : 'rounded-md bg-muted/20 p-2 text-xs'}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono font-semibold">{formatTachoNumber(r.container_id)}</span>
                        <span className="tabular-nums">{r.gross_weight_kg} kg bruto{net !== null ? ` · ${net} kg neto` : ''}</span>
                        {isCoordinator && !r.voided_at && !s.voided_at && (
                          <Button variant="ghost" size="icon" aria-label="Anular pesaje" className="text-red-600" onClick={() => setVoiding({ kind: 'reception', id: r.id })}>
                            <Ban className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                      {isCoordinator && !r.voided_at && !s.voided_at && (
                        <div className="mt-2 grid grid-cols-3 gap-2">
                          <input
                            type="number" step="0.01" defaultValue={r.gross_weight_kg}
                            aria-label="Peso bruto"
                            onBlur={(e) => { const v = parseFloat(e.target.value); if (!Number.isNaN(v) && v !== r.gross_weight_kg) saveField(r, { gross_weight_kg: v }) }}
                            className="rounded border border-foreground/15 bg-background px-2 py-1"
                          />
                          <select
                            defaultValue={r.waste_type ?? 'infectious'} aria-label="Tipo de desecho"
                            onChange={(e) => saveField(r, { waste_type: e.target.value as WasteType })}
                            className="rounded border border-foreground/15 bg-background px-2 py-1"
                          >
                            {WASTE_TYPES.map((w) => <option key={w.value} value={w.value}>{w.label}</option>)}
                          </select>
                          <select
                            defaultValue={r.container_id} aria-label="Tacho"
                            onChange={(e) => saveField(r, { container_id: e.target.value })}
                            className="rounded border border-foreground/15 bg-background px-2 py-1 font-mono"
                          >
                            {containers.filter((c) => c.status === 'active').map((c) => (
                              <option key={c.id} value={c.id}>{formatTachoNumber(c.id)}</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  )
                })}
                {isCoordinator && !s.voided_at && (
                  <Button variant="ghost" size="sm" className="text-red-600" onClick={() => setVoiding({ kind: 'session', id: s.id })}>
                    <X className="mr-1 h-3.5 w-3.5" /> Anular sesión completa
                  </Button>
                )}
              </div>
            )}
          </div>
        )
      })}

      {voiding?.kind === 'reception' && (() => {
        const r = receptions.find((x) => x.id === voiding.id)
        if (!r) return null
        return (
          <ConfirmVoidDialog
            title="¿Anular este pesaje?"
            description={<>El tacho <strong className="font-mono">{formatTachoNumber(r.container_id)}</strong> volverá a quedar pendiente por pesar. El registro queda anulado con motivo.</>}
            confirmLabel="Anular pesaje"
            onCancel={() => setVoiding(null)}
            onConfirm={(reason) => voidReception(r, reason)}
          />
        )
      })()}

      {voiding?.kind === 'session' && (
        <ConfirmVoidDialog
          title="¿Anular la sesión completa?"
          description="Todas las recepciones vigentes de la sesión se anularán y esos tachos volverán a pendientes por pesar."
          confirmLabel="Anular sesión"
          onCancel={() => setVoiding(null)}
          onConfirm={(reason) => voidSession(voiding.id, reason)}
        />
      )}
    </div>
  )
}
