'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PhotoCapture } from '@/components/register/photo-capture'
import { cn } from '@/lib/utils'
import { computeNetWeight } from '@/lib/data/containers'
import type { Container, Company, WasteType } from '@/lib/types'

const WASTE_LABELS: Record<WasteType, string> = {
  infectious: 'Peligroso infeccioso',
  anatomopathological: 'Anatomopatológico',
  cytotoxic: 'Citotóxico',
  liquid: 'Líquidos',
  morgue: 'Morgue',
}

/**
 * Estado de un envase pesado dentro de la sesión actual.
 * El `waste_type` se deriva automáticamente del envase elegido (no se selecciona).
 */
export interface WeighingFormState {
  container_id: string
  photo_container: string | null
  photo_scale: string | null
  gross_weight: string
  observations: string                  // NEW
}

export const EMPTY_WEIGHING_FORM: WeighingFormState = {
  container_id: '',
  photo_container: null,
  photo_scale: null,
  gross_weight: '',
  observations: '',                     // NEW
}

interface Props {
  state: WeighingFormState
  onChange: (updates: Partial<WeighingFormState>) => void
  /** Lista de envases que aparecen en el dropdown (ya filtrada por el padre). */
  availableContainers: Container[]
  /** Lista completa para resolver datos del envase si se está editando uno ya pesado. */
  allContainers: Container[]
  companies: Company[]
  /** Cuando true: form atenuado y no editable. */
  locked: boolean
  mode: 'create' | 'edit'
  onSubmit: () => void
  onCancelEdit?: () => void
  onDelete?: () => void
}

export function WeighingForm({
  state,
  onChange,
  availableContainers,
  allContainers,
  companies,
  locked,
  mode,
  onSubmit,
  onCancelEdit,
  onDelete,
}: Props) {
  const companyMap = Object.fromEntries(companies.map((c) => [c.id, c.name]))
  const selectedContainer = allContainers.find((c) => c.id === state.container_id) ?? null

  // En modo edit, el envase actualmente cargado puede no estar en
  // availableContainers (porque ya tiene reception). Lo agregamos al inicio
  // para que siga visible y editable.
  const dropdownContainers =
    mode === 'edit' && selectedContainer && !availableContainers.some((c) => c.id === selectedContainer.id)
      ? [selectedContainer, ...availableContainers]
      : availableContainers

  const grossWeight = parseFloat(state.gross_weight)
  const hasValidWeight =
    !!state.gross_weight &&
    !Number.isNaN(grossWeight) &&
    selectedContainer != null &&
    grossWeight > selectedContainer.tare_weight_kg

  const canSubmit =
    !!state.container_id &&
    !!state.photo_container &&
    !!state.photo_scale &&
    hasValidWeight

  return (
    <div
      className={cn(
        'space-y-5 transition-opacity',
        locked && 'pointer-events-none opacity-50 select-none',
      )}
      aria-disabled={locked}
    >
      {/* Envase */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-foreground">
          Número de envase <span className="text-red-500">*</span>
        </label>
        <Select
          value={state.container_id}
          onValueChange={(v) => onChange({ container_id: v ?? '' })}
        >
          <SelectTrigger>
            <SelectValue placeholder={
              dropdownContainers.length === 0
                ? 'No hay envases pendientes de pesar'
                : 'Seleccionar envase'
            } />
          </SelectTrigger>
          <SelectContent>
            {dropdownContainers.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.id} — {companyMap[c.company_id] ?? '—'} · {c.size_liters} L
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {dropdownContainers.length === 0 && mode === 'create' && (
          <p className="text-xs text-amber-700">
            No hay envases sucios recogidos pendientes de pesar. Registrá un
            recorrido primero para que aparezcan envases acá.
          </p>
        )}
        {selectedContainer && (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Badge variant="outline" className="font-normal">
              Tipo: <strong className="ml-1 font-semibold">{WASTE_LABELS[selectedContainer.waste_type]}</strong>
            </Badge>
            <Badge variant="outline" className="font-normal">
              Tara: <strong className="ml-1 font-semibold">{selectedContainer.tare_weight_kg} kg</strong>
            </Badge>
            <Badge variant="outline" className="font-normal">
              Tamaño: <strong className="ml-1 font-semibold">{selectedContainer.size_liters} L</strong>
            </Badge>
          </div>
        )}
      </div>

      {/* Peso bruto */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-foreground">
          Peso bruto (kg) <span className="text-red-500">*</span>
        </label>
        <Input
          type="number"
          step="0.1"
          min="0"
          value={state.gross_weight}
          onChange={(e) => onChange({ gross_weight: e.target.value })}
          placeholder="Ej: 43.7"
          className="text-lg h-12"
        />
        {selectedContainer && hasValidWeight && (
          <p className="text-sm text-muted-foreground">
            Peso neto estimado:{' '}
            <strong className="text-foreground">
              {computeNetWeight(grossWeight, selectedContainer.tare_weight_kg)} kg
            </strong>
          </p>
        )}
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
          placeholder="Ej: Yaris #3, Picanto rojo, tacho con daño en tapa…"
          rows={2}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-y"
        />
        <p className="text-xs text-muted-foreground">
          Opcional. Útil para anotar identificador manual de envases sin tara registrada (Yaris, Picanto) o cualquier detalle del pesaje.
        </p>
      </div>

      {/* Fotos */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <PhotoCapture
          label="Foto del envase"
          required
          preview={state.photo_container}
          onCapture={(url) => onChange({ photo_container: url })}
          onRemove={() => onChange({ photo_container: null })}
        />
        <PhotoCapture
          label="Foto de la balanza"
          required
          preview={state.photo_scale}
          onCapture={(url) => onChange({ photo_scale: url })}
          onRemove={() => onChange({ photo_scale: null })}
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
                Eliminar
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  )
}
