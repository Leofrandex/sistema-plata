import {
  DRAFT_MAX_AGE_MS,
  applyRestoredPhoto,
  isDraftRestorable,
  isDraftWorthSaving,
  type WeighingDraft,
} from '@/lib/weighing-draft'
import { EMPTY_WEIGHING_FORM } from '@/components/register/weighing-form'

const NOW = Date.parse('2026-09-25T10:00:00Z')

function draft(over: Partial<WeighingDraft> = {}): WeighingDraft {
  return {
    v: 1,
    savedAt: NOW - 60_000,
    weighingSessionId: 'ses-1',
    editingReceptionId: null,
    form: { ...EMPTY_WEIGHING_FORM, container_id: '075', gross_weight: '31.5', photo_container: 'data:tacho' },
    cameraSlot: null,
    ...over,
  }
}

describe('isDraftRestorable', () => {
  it('restaura un borrador reciente de la misma sesión de pesaje', () => {
    expect(isDraftRestorable(draft(), NOW, 'ses-1')).toBe(true)
  })

  it('no restaura si la sesión activa es otra (o no hay sesión)', () => {
    expect(isDraftRestorable(draft(), NOW, 'ses-2')).toBe(false)
    expect(isDraftRestorable(draft(), NOW, null)).toBe(false)
  })

  it('no restaura un borrador más viejo que el máximo', () => {
    expect(isDraftRestorable(draft({ savedAt: NOW - DRAFT_MAX_AGE_MS - 1 }), NOW, 'ses-1')).toBe(false)
  })

  it('no restaura nada si no hay borrador o es de otra versión', () => {
    expect(isDraftRestorable(null, NOW, 'ses-1')).toBe(false)
    expect(isDraftRestorable({ ...draft(), v: 2 } as unknown as WeighingDraft, NOW, 'ses-1')).toBe(false)
  })
})

describe('applyRestoredPhoto', () => {
  it('pone la foto recuperada en el hueco que se estaba fotografiando', () => {
    const out = applyRestoredPhoto(draft({ cameraSlot: 'photo_scale' }), 'data:balanza', NOW)
    expect(out.form.photo_scale).toBe('data:balanza')
    expect(out.form.photo_container).toBe('data:tacho')
    expect(out.cameraSlot).toBeNull()
    expect(out.savedAt).toBe(NOW)
  })

  it('no toca el borrador si no había una foto en curso', () => {
    const d = draft()
    expect(applyRestoredPhoto(d, 'data:x', NOW)).toBe(d)
  })
})

describe('isDraftWorthSaving', () => {
  it('un formulario vacío fuera de edición no se guarda', () => {
    expect(isDraftWorthSaving(EMPTY_WEIGHING_FORM, null)).toBe(false)
  })

  it('cualquier dato cargado o una edición en curso sí se guarda', () => {
    expect(isDraftWorthSaving({ ...EMPTY_WEIGHING_FORM, gross_weight: '12' }, null)).toBe(true)
    expect(isDraftWorthSaving(EMPTY_WEIGHING_FORM, 'rec-1')).toBe(true)
  })
})
