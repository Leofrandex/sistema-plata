'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { Button } from '@hospiwaste/shared/components/ui/button'
import { ConfirmVoidDialog } from '@hospiwaste/shared/components/ui/confirm-void-dialog'
import { createClient } from '@hospiwaste/shared/lib/supabase/client'
import * as q from '@hospiwaste/shared/lib/supabase/queries'
import { useStore } from '@hospiwaste/shared/lib/store'
import { cn } from '@hospiwaste/shared/lib/utils'

interface Props {
  equipmentId: string
  /** Cambia para forzar recarga (tras registrar un mantenimiento). */
  reloadKey: number
  /** Avisa al padre que cambió el historial (para refrescar el semáforo si aplica). */
  onChanged: () => void
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}

export function MaintenanceHistory({ equipmentId, reloadKey, onChanged }: Props) {
  const users = useStore((s) => s.users)
  const currentProfileId = useStore((s) => s.currentProfileId)
  const [items, setItems] = useState<q.EquipmentMaintenanceRow[]>([])
  const [photoUrls, setPhotoUrls] = useState<Map<string, string[]>>(new Map())
  const [loading, setLoading] = useState(true)
  const [voiding, setVoiding] = useState<q.EquipmentMaintenanceRow | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const db = createClient()
    setLoading(true)
    q.listMaintenanceByEquipment(db, equipmentId)
      .then(async (rows) => {
        if (cancelled) return
        setItems(rows)
        // Fotos por mantenimiento (best-effort)
        const map = new Map<string, string[]>()
        for (const row of rows) {
          try {
            const photos = await q.listPhotosByEvent(db, 'maintenance', row.id)
            if (photos.length === 0) continue
            const urls = await q.getPhotoUrls(db, photos)
            map.set(row.id, photos.map((p) => urls.get(p.id)).filter((u): u is string => Boolean(u)))
          } catch (err) {
            console.error('[equipment] cargar fotos de mantenimiento falló:', err)
          }
        }
        if (!cancelled) setPhotoUrls(map)
      })
      .catch((err) => {
        console.error('[equipment] cargar historial falló:', err)
        if (!cancelled) setError('No se pudo cargar el historial de mantenimientos.')
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [equipmentId, reloadKey])

  async function handleVoid(reason: string) {
    if (!voiding) return
    try {
      const db = createClient()
      await q.voidMaintenance(db, voiding.id, { voidedBy: currentProfileId, reason })
      setVoiding(null)
      onChanged()
    } catch (err) {
      console.error('[equipment] anular mantenimiento falló:', err)
      setError('No se pudo anular el mantenimiento.')
      setVoiding(null)
    }
  }

  if (loading) return <p className="text-sm text-slate-400">Cargando historial…</p>

  return (
    <div className="space-y-3">
      {error && <p className="text-sm text-red-600">{error}</p>}
      {items.length === 0 && <p className="text-sm text-slate-400">Sin mantenimientos registrados todavía.</p>}
      {items.map((m) => {
        const voided = Boolean(m.voided_at)
        const author = m.created_by ? users.find((u) => u.id === m.created_by)?.name ?? '—' : '—'
        const urls = photoUrls.get(m.id) ?? []
        return (
          <div key={m.id} className={cn('rounded-lg border p-4 space-y-2', voided ? 'bg-slate-50 opacity-70' : 'bg-white')}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className={cn('font-medium text-slate-800', voided && 'line-through')}>
                  {formatDate(m.performed_at)}
                  <span className="text-slate-400 font-normal"> · registrado por {author}</span>
                </p>
                {m.notes && <p className={cn('text-sm text-slate-600', voided && 'line-through')}>{m.notes}</p>}
                {voided && (
                  <p className="text-xs text-red-600">Anulado{m.voided_reason ? `: ${m.voided_reason}` : ''}</p>
                )}
              </div>
              {!voided && (
                <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700 hover:bg-red-50 shrink-0" onClick={() => setVoiding(m)}>
                  Anular
                </Button>
              )}
            </div>
            {urls.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {urls.map((url, i) => (
                  <a key={i} href={url} target="_blank" rel="noreferrer">
                    <Image src={url} alt={`Foto ${i + 1}`} width={96} height={96} className="h-24 w-24 rounded-md object-cover border" unoptimized />
                  </a>
                ))}
              </div>
            )}
          </div>
        )
      })}
      {voiding && (
        <ConfirmVoidDialog
          title="Anular mantenimiento"
          description={`Se anulará el mantenimiento del ${formatDate(voiding.performed_at)}. El semáforo dejará de contarlo.`}
          confirmLabel="Anular"
          onCancel={() => setVoiding(null)}
          onConfirm={handleVoid}
        />
      )}
    </div>
  )
}
