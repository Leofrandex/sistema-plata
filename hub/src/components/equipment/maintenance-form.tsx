'use client'

import { useState } from 'react'
import { Button } from '@hospiwaste/shared/components/ui/button'
import { PhotoCaptureMulti } from '@hospiwaste/shared/components/register/photo-capture-multi'
import { createClient } from '@hospiwaste/shared/lib/supabase/client'
import * as q from '@hospiwaste/shared/lib/supabase/queries'
import { uploadEventPhotos } from '@hospiwaste/shared/lib/data/photos'
import { todayISO } from '@/lib/data/equipment-status'
import { useStore } from '@hospiwaste/shared/lib/store'

interface Props {
  equipmentId: string
  equipmentName: string
  onSaved: () => void
  onCancel: () => void
}

export function MaintenanceForm({ equipmentId, equipmentName, onSaved, onCancel }: Props) {
  const currentProfileId = useStore((s) => s.currentProfileId)
  const [performedAt, setPerformedAt] = useState(todayISO())
  const [notes, setNotes] = useState('')
  const [photos, setPhotos] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    if (!performedAt) { setError('La fecha es obligatoria.'); return }
    setSaving(true)
    setError(null)
    try {
      const db = createClient()
      const row = await q.createMaintenance(db, {
        equipment_id: equipmentId,
        performed_at: performedAt,
        notes: notes.trim() || null,
        created_by: currentProfileId,
      })
      // Best-effort: si alguna foto falla, el mantenimiento ya quedó guardado.
      const uploaded = await uploadEventPhotos(db, {
        dataUrls: photos,
        eventType: 'maintenance',
        eventId: row.id,
        label: `Mantenimiento ${equipmentName}`,
        uploadedBy: currentProfileId,
      })
      if (uploaded.length < photos.length) {
        console.error('[equipment] algunas fotos no se subieron:', photos.length - uploaded.length)
      }
      onSaved()
    } catch (err) {
      console.error('[equipment] registrar mantenimiento falló:', err)
      setError('No se pudo registrar el mantenimiento. Revisa tu conexión e intenta de nuevo.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <label className="text-sm font-medium text-slate-700">Fecha del mantenimiento <span className="text-red-600">*</span></label>
        <input
          type="date"
          value={performedAt}
          max={todayISO()}
          onChange={(e) => setPerformedAt(e.target.value)}
          className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>
      <div className="space-y-1">
        <label className="text-sm font-medium text-slate-700">Observaciones</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Ej.: cambio de aceite, revisión de resistencias…"
          className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>
      <PhotoCaptureMulti
        label="Fotos de evidencia (opcional)"
        photos={photos}
        onAdd={(dataUrl) => setPhotos((p) => [...p, dataUrl])}
        onRemove={(index) => setPhotos((p) => p.filter((_, i) => i !== index))}
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-3 justify-end">
        <Button variant="outline" onClick={onCancel} disabled={saving}>Cancelar</Button>
        <Button onClick={handleSave} disabled={saving}>{saving ? 'Guardando…' : 'Registrar mantenimiento'}</Button>
      </div>
    </div>
  )
}
