'use client'

import { useState } from 'react'
import { Button } from '@hospiwaste/shared/components/ui/button'
import { Input } from '@hospiwaste/shared/components/ui/input'
import { Badge } from '@hospiwaste/shared/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@hospiwaste/shared/components/ui/select'
import { PhotoCapture } from '@/components/register/photo-capture'
import { filterContainers } from '@/components/register/container-selector'
import { cn } from '@hospiwaste/shared/lib/utils'
import { computeNetWeight, formatTachoNumber } from '@hospiwaste/shared/lib/data/containers'
import type { Container, Company, WasteType } from '@hospiwaste/shared/lib/types'
import type { CameraSlot } from '@/lib/weighing-draft'

const WASTE_LABELS: Record<WasteType, string> = {
  infectious: 'Peligroso infeccioso',
  anatomopathological: 'Anatomopatológico',
  cytotoxic: 'Citotóxico',
  liquid: 'Líquidos',
  morgue: 'Morgue',
  metallic: 'Metálicos No reutilizables',
}

export interface WeighingFormState {
  container_id: string
  /** Empresa a la que se atribuye este pesaje. En modo interino la elige el
   *  operador; con recorridos activos se precarga con la empresa heredada. */
  company_id: string
  photo_container: string | null
  photo_scale: string | null
  gross_weight: string
  observations: string
  waste_type: WasteType
  treat_immediately: boolean
}

export const EMPTY_WEIGHING_FORM: WeighingFormState = {
  container_id: '',
  company_id: '',
  photo_container: null,
  photo_scale: null,
  gross_weight: '',
  observations: '',
  waste_type: 'infectious',
  treat_immediately: false,
}

interface Props {
  state: WeighingFormState
  onChange: (updates: Partial<WeighingFormState>) => void
  /** Tachos pendientes de pesar (incluye la flota Yaris Y1..Y26). */
  availableContainers: Container[]
  /** Tachos dedicados a metálico (siempre disponibles; solo se ofrecen con tipo 'metallic'). */
  metallicContainers: Container[]
  /** Lista completa para resolver datos del tacho si se está editando uno ya pesado. */
  allContainers: Container[]
  /** Empresas disponibles para atribuir el pesaje. */
  companies: Company[]
  /** Aviso no bloqueante: el tacho elegido ya tiene un pesaje vigente de hoy. */
  duplicateWarning?: string | null
  locked: boolean
  mode: 'create' | 'edit'
  onSubmit: () => void
  onCancelEdit?: () => void
  onDelete?: () => void
  /** Se espera antes de abrir la cámara nativa: guarda el borrador por si Android mata la app. */
  onBeforeCamera?: (slot: CameraSlot) => Promise<void>
}

export function WeighingForm({
  state,
  onChange,
  availableContainers,
  metallicContainers,
  allContainers,
  companies,
  duplicateWarning,
  locked,
  mode,
  onSubmit,
  onCancelEdit,
  onDelete,
  onBeforeCamera,
}: Props) {
  const selectedContainer = allContainers.find((c) => c.id === state.container_id) ?? null

  const isMetallic = state.waste_type === 'metallic'

  // En modo edit, el tacho actualmente cargado puede no estar en
  // availableContainers (porque ya tiene reception). Lo agregamos al inicio
  // para que siga visible y editable.
  const dropdownContainers = (() => {
    const base = isMetallic ? metallicContainers : availableContainers
    if (mode === 'edit' && selectedContainer && !base.some((c) => c.id === selectedContainer.id)) {
      return [selectedContainer, ...base]
    }
    return base
  })()

  const grossWeight = parseFloat(state.gross_weight)
  const hasValidWeight =
    !!state.gross_weight &&
    !Number.isNaN(grossWeight) &&
    selectedContainer != null &&
    grossWeight > selectedContainer.tare_weight_kg

  const netWeight = selectedContainer && hasValidWeight
    ? computeNetWeight(grossWeight, selectedContainer.tare_weight_kg)
    : null

  const canSubmit =
    !!state.container_id &&
    !!state.company_id &&
    !!state.photo_container &&
    !!state.photo_scale &&
    hasValidWeight

  function changeWasteType(v: string | null) {
    const next = (v ?? 'infectious') as WasteType
    const crossingMetallic = (state.waste_type === 'metallic') !== (next === 'metallic')
    if (crossingMetallic) setTachoSearch('')
    onChange({
      waste_type: next,
      ...(crossingMetallic ? { container_id: '' } : {}),
    })
  }

  const [tachoSearch, setTachoSearch] = useState('')
  const tachoResults = filterContainers(dropdownContainers, tachoSearch).slice(0, 8)

  return (
    <div
      className={cn(
        'space-y-5 transition-opacity',
        locked && 'pointer-events-none opacity-50 select-none',
      )}
      aria-disabled={locked}
    >
      {/* Tacho: buscador por número (la flota Yaris Y1..Y26 vive en la misma lista) */}
      <div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">
            {isMetallic ? 'Tacho metálico' : 'Número de tacho'} <span className="text-red-500">*</span>
          </label>
          {isMetallic ? (
            <Select
              value={state.container_id}
              onValueChange={(v) => onChange({ container_id: v ?? '' })}
            >
              <SelectTrigger>
                <SelectValue placeholder={
                  metallicContainers.length === 0 ? 'No hay tachos metálicos' : 'Seleccionar tacho metálico'
                } />
              </SelectTrigger>
              <SelectContent>
                {dropdownContainers.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {formatTachoNumber(c.id)} · {c.size_liters} L
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : state.container_id ? (
            <div className="flex items-center gap-2 rounded-md border border-input bg-background px-3 h-10">
              <span className="font-mono font-semibold text-foreground">
                {formatTachoNumber(state.container_id)}
              </span>
              <button
                type="button"
                onClick={() => { setTachoSearch(''); onChange({ container_id: '' }) }}
                className="ml-auto text-xs underline text-muted-foreground"
              >
                Cambiar
              </button>
            </div>
          ) : (
            <>
              <Input
                value={tachoSearch}
                onChange={(e) => setTachoSearch(e.target.value)}
                placeholder="Número de tacho (ej: 145 o Y3)"
                inputMode="text"
                className="h-10"
              />
              {tachoSearch.length > 0 && (
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {tachoResults.length === 0 && (
                    <p className="text-xs text-muted-foreground py-2">
                      No se encontró ningún tacho con ese número.
                    </p>
                  )}
                  {tachoResults.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => { setTachoSearch(''); onChange({ container_id: c.id }) }}
                      className="w-full text-left rounded-md border border-border px-3 py-2 text-sm hover:border-accent/40 hover:bg-accent/5"
                    >
                      <span className="font-mono font-semibold">{formatTachoNumber(c.id)}</span>
                      <span className="text-muted-foreground"> · {c.size_liters} L</span>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {dropdownContainers.length === 0 && mode === 'create' && (
        <p className="text-xs text-amber-700">
          {isMetallic
            ? 'No hay tachos metálicos configurados. Marcá un tacho como dedicado a metálico desde Admin → Tachos.'
            : 'No hay tachos activos disponibles.'}
        </p>
      )}
      {selectedContainer && (
        <div className="flex flex-wrap items-center gap-2 -mt-2">
          <Badge variant="outline" className="font-normal">
            Tara: <strong className="ml-1 font-semibold">{selectedContainer.tare_weight_kg} kg</strong>
          </Badge>
          <Badge variant="outline" className="font-normal">
            Tamaño: <strong className="ml-1 font-semibold">{selectedContainer.size_liters} L</strong>
          </Badge>
          {selectedContainer.is_yaris_container && (
            <Badge variant="outline" className="font-normal bg-amber-50 border-amber-300 text-amber-900">
              Flota Yaris
            </Badge>
          )}
          {selectedContainer.is_metallic_dedicated && (
            <Badge variant="outline" className="font-normal bg-slate-100 border-slate-300 text-slate-700">
              Tacho metálico
            </Badge>
          )}
        </div>
      )}
      {duplicateWarning && (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          {duplicateWarning}
        </p>
      )}

      {/* Tipo de desecho — input del operador (ya no es propiedad del tacho) */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-foreground">
          Tipo de desecho <span className="text-red-500">*</span>
        </label>
        <Select value={state.waste_type} onValueChange={changeWasteType}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {(Object.keys(WASTE_LABELS) as WasteType[]).map((w) => (
              <SelectItem key={w} value={w}>{WASTE_LABELS[w]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Empresa — en modo interino la elige el operador (no hay recorrido del
          que heredarla). Con recorridos activos llega precargada. */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-foreground">
          Empresa <span className="text-red-500">*</span>
        </label>
        <Select
          value={state.company_id}
          onValueChange={(v) => onChange({ company_id: v ?? '' })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Seleccionar empresa" />
          </SelectTrigger>
          <SelectContent>
            {companies.map((co) => (
              <SelectItem key={co.id} value={co.id}>{co.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Peso bruto + peso neto destacado */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-foreground">
          Peso bruto (kg) <span className="text-red-500">*</span>
        </label>
        <div className="flex items-stretch gap-3">
          <Input
            type="number"
            step="0.1"
            min="0"
            value={state.gross_weight}
            onChange={(e) => onChange({ gross_weight: e.target.value })}
            placeholder="Ej: 43.7"
            className="text-lg h-14 max-w-[10rem] sm:max-w-[12rem] tabular-nums"
          />
          <div
            className={cn(
              'flex-1 min-w-0 flex flex-col justify-center px-4 py-2 rounded-lg border transition-colors',
              netWeight != null
                ? 'border-accent/40 bg-accent/5'
                : 'border-dashed border-muted-foreground/20 bg-muted/20',
            )}
            aria-live="polite"
          >
            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Peso neto
            </span>
            {netWeight != null ? (
              <span className="text-2xl sm:text-3xl font-bold tabular-nums text-accent leading-tight">
                {netWeight} <span className="text-base font-semibold text-accent/80">kg</span>
              </span>
            ) : (
              <span className="text-sm text-muted-foreground/70">
                —
              </span>
            )}
          </div>
        </div>
        {state.gross_weight && selectedContainer && !hasValidWeight && (
          <p className="text-xs text-red-600">
            El peso bruto debe ser mayor que la tara ({selectedContainer.tare_weight_kg} kg).
          </p>
        )}
      </div>

      {/* Observaciones */}
      <div className="space-y-1.5">
        <label htmlFor="weighing-observations" className="text-sm font-medium text-foreground">
          Observaciones
        </label>
        <textarea
          id="weighing-observations"
          value={state.observations}
          onChange={(e) => onChange({ observations: e.target.value })}
          placeholder="Ej: tacho con daño en tapa, carga mixta…"
          rows={2}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-y"
        />
      </div>

      {/* Fotos — balanza arriba, tacho abajo (solo orden visual; el orden de
          subida photo_container/photo_scale no cambia para no romper el reporte) */}
      <div className="grid grid-cols-1 gap-4">
        <PhotoCapture
          label="Foto de la balanza"
          required
          preview={state.photo_scale}
          onCapture={(url) => onChange({ photo_scale: url })}
          onRemove={() => onChange({ photo_scale: null })}
          onBeforeCamera={onBeforeCamera && (() => onBeforeCamera('photo_scale'))}
        />
        <PhotoCapture
          label="Foto del tacho"
          required
          preview={state.photo_container}
          onCapture={(url) => onChange({ photo_container: url })}
          onRemove={() => onChange({ photo_container: null })}
          onBeforeCamera={onBeforeCamera && (() => onBeforeCamera('photo_container'))}
        />
      </div>

      {/* Acciones */}
      <div className="flex flex-col gap-3 pt-2 sm:flex-row-reverse">
        {mode === 'create' ? (
          <Button
            type="button"
            onClick={onSubmit}
            disabled={!canSubmit}
            className="sm:flex-1"
            size="lg"
          >
            Guardar y agregar otro
          </Button>
        ) : (
          <>
            <Button
              type="button"
              onClick={onSubmit}
              disabled={!canSubmit}
              className="sm:flex-1"
            >
              Guardar cambios
            </Button>
            {onCancelEdit && (
              <Button
                type="button"
                variant="outline"
                onClick={onCancelEdit}
                className="sm:flex-1"
              >
                Cancelar
              </Button>
            )}
            {onDelete && (
              <Button
                type="button"
                variant="ghost"
                onClick={onDelete}
                className="text-red-600 hover:text-red-700 hover:bg-red-50 sm:flex-none"
              >
                Deshacer pesaje
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  )
}
