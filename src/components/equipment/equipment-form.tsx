'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'

export interface EquipmentFormValues {
  name: string
  brand: string | null
  model: string | null
  serial: string | null
  identification: string | null
  owner: string | null
  provider: string | null
  maintenance_frequency_days: number | null
}

interface Props {
  initial?: EquipmentFormValues
  submitLabel: string
  onSubmit: (values: EquipmentFormValues) => Promise<void>
  onCancel?: () => void
}

const FREQUENCY_SHORTCUTS = [
  { label: '1 mes', days: 30 },
  { label: '3 meses', days: 90 },
  { label: '6 meses', days: 180 },
  { label: '1 año', days: 365 },
]

const EMPTY: EquipmentFormValues = {
  name: '', brand: null, model: null, serial: null,
  identification: null, owner: null, provider: null,
  maintenance_frequency_days: null,
}

export function EquipmentForm({ initial, submitLabel, onSubmit, onCancel }: Props) {
  const [values, setValues] = useState<EquipmentFormValues>(initial ?? EMPTY)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function setText(field: keyof EquipmentFormValues, raw: string) {
    setValues((v) => ({ ...v, [field]: raw.trim() === '' ? null : raw }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!values.name.trim()) { setError('El nombre del equipo es obligatorio.'); return }
    setSaving(true)
    setError(null)
    try {
      await onSubmit({ ...values, name: values.name.trim() })
    } catch (err) {
      console.error('[equipment] guardar equipo falló:', err)
      setError('No se pudo guardar. Revisa tu conexión e intenta de nuevo.')
    } finally {
      setSaving(false)
    }
  }

  const textField = (label: string, field: keyof EquipmentFormValues, required = false) => (
    <div className="space-y-1">
      <label className="text-sm font-medium text-slate-700">
        {label}{required && <span className="text-red-600"> *</span>}
      </label>
      <input
        value={(values[field] as string | null) ?? ''}
        onChange={(e) => field === 'name'
          ? setValues((v) => ({ ...v, name: e.target.value }))
          : setText(field, e.target.value)}
        className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-primary/30"
      />
    </div>
  )

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {textField('Nombre del equipo', 'name', true)}
        {textField('Identificación', 'identification')}
        {textField('Marca', 'brand')}
        {textField('Modelo', 'model')}
        {textField('Serial', 'serial')}
        {textField('Dueño', 'owner')}
        {textField('Proveedor', 'provider')}
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium text-slate-700">Frecuencia de mantenimiento (días)</label>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="number"
            min={1}
            value={values.maintenance_frequency_days ?? ''}
            onChange={(e) => setValues((v) => ({
              ...v,
              maintenance_frequency_days: e.target.value === '' ? null : Math.max(1, Number(e.target.value)),
            }))}
            placeholder="Sin configurar"
            className="w-40 px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-primary/30"
          />
          {FREQUENCY_SHORTCUTS.map(({ label, days }) => (
            <Button
              key={days}
              type="button"
              variant={values.maintenance_frequency_days === days ? 'default' : 'outline'}
              size="sm"
              onClick={() => setValues((v) => ({ ...v, maintenance_frequency_days: days }))}
            >
              {label}
            </Button>
          ))}
        </div>
        <p className="text-xs text-slate-400">Sin frecuencia el equipo queda "Sin configurar" en el semáforo.</p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-3 justify-end">
        {onCancel && <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>}
        <Button type="submit" disabled={saving}>{saving ? 'Guardando…' : submitLabel}</Button>
      </div>
    </form>
  )
}
