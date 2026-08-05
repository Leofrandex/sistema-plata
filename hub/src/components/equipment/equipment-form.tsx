'use client'

import { useState } from 'react'
import { Button } from '@hospiwaste/shared/components/ui/button'

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

/** Unidades del campo de frecuencia. Se persiste siempre en días. */
type FrequencyUnit = 'days' | 'months' | 'years'

const DAYS_PER_UNIT: Record<FrequencyUnit, number> = { days: 1, months: 30, years: 365 }

const UNIT_LABELS: Record<FrequencyUnit, string> = {
  days: 'días',
  months: 'meses',
  years: 'años',
}

/** Elige la unidad más "grande" que represente los días sin resto (365 → 1 año, 45 → 45 días). */
function splitFrequency(days: number | null): { amount: string; unit: FrequencyUnit } {
  if (days === null) return { amount: '', unit: 'months' }
  if (days % DAYS_PER_UNIT.years === 0) return { amount: String(days / DAYS_PER_UNIT.years), unit: 'years' }
  if (days % DAYS_PER_UNIT.months === 0) return { amount: String(days / DAYS_PER_UNIT.months), unit: 'months' }
  return { amount: String(days), unit: 'days' }
}

function toDays(amount: string, unit: FrequencyUnit): number | null {
  const n = Number(amount)
  if (amount.trim() === '' || !Number.isFinite(n) || n <= 0) return null
  return Math.max(1, Math.round(n * DAYS_PER_UNIT[unit]))
}

const EMPTY: EquipmentFormValues = {
  name: '', brand: null, model: null, serial: null,
  identification: null, owner: null, provider: null,
  maintenance_frequency_days: null,
}

export function EquipmentForm({ initial, submitLabel, onSubmit, onCancel }: Props) {
  const [values, setValues] = useState<EquipmentFormValues>(initial ?? EMPTY)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // La cantidad se mantiene como texto para no perder lo que el usuario escribe
  // mientras edita (p. ej. borrar el campo por completo antes de teclear otro número).
  const [freq, setFreq] = useState(() => splitFrequency(initial?.maintenance_frequency_days ?? null))

  function setFrequency(next: { amount?: string; unit?: FrequencyUnit }) {
    const merged = { ...freq, ...next }
    setFreq(merged)
    setValues((v) => ({ ...v, maintenance_frequency_days: toDays(merged.amount, merged.unit) }))
  }

  const frequencyDays = values.maintenance_frequency_days

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
        <label className="text-sm font-medium text-slate-700">Frecuencia de mantenimiento</label>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="number"
            min={1}
            step={1}
            inputMode="numeric"
            value={freq.amount}
            onChange={(e) => setFrequency({ amount: e.target.value })}
            placeholder="Sin configurar"
            className="w-32 px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-primary/30"
          />
          <select
            value={freq.unit}
            onChange={(e) => setFrequency({ unit: e.target.value as FrequencyUnit })}
            className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-primary/30"
          >
            {(Object.keys(UNIT_LABELS) as FrequencyUnit[]).map((u) => (
              <option key={u} value={u}>{UNIT_LABELS[u]}</option>
            ))}
          </select>
        </div>
        <p className="text-xs text-slate-400">
          {frequencyDays === null
            ? 'Sin frecuencia el equipo queda "Sin configurar" en el semáforo.'
            : `Equivale a ${frequencyDays} ${frequencyDays === 1 ? 'día' : 'días'} entre mantenimientos.`}
        </p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-3 justify-end">
        {onCancel && <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>}
        <Button type="submit" disabled={saving}>{saving ? 'Guardando…' : submitLabel}</Button>
      </div>
    </form>
  )
}
