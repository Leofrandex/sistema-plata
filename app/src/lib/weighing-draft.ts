import { EMPTY_WEIGHING_FORM, type WeighingFormState } from '@/components/register/weighing-form'

/**
 * Borrador del pesaje en curso, para sobrevivir a que Android mate la app.
 *
 * Por qué existe: "Tomar foto" abre la app de cámara de Android y el APK queda
 * en segundo plano. En teléfonos con poca memoria Android lo cierra; al volver,
 * la app arranca de cero en el Home y se pierde lo que estaba en el formulario
 * (tacho, peso y la foto recién tomada). Lo ya registrado no se pierde porque
 * vive en el LocalStore. Ver log 2026-09-25-pesaje-sobrevive-camara.
 *
 * Se guarda en Preferences (SharedPreferences) antes de abrir la cámara y cada
 * vez que cambia el formulario. Al reabrir, AppLifecycle vuelve a Pesaje y la
 * página lo restaura; si Android entrega la foto pendiente (`appRestoredResult`)
 * se coloca en el hueco que se estaba fotografiando.
 */

export type CameraSlot = 'photo_scale' | 'photo_container'

export interface WeighingDraft {
  v: 1
  /** epoch ms */
  savedAt: number
  weighingSessionId: string
  editingReceptionId: string | null
  form: WeighingFormState
  /** Hueco que se estaba fotografiando cuando se abrió la cámara; null si ninguno. */
  cameraSlot: CameraSlot | null
}

/** Más viejo que esto, el borrador ya no corresponde a lo que el operador tiene delante. */
export const DRAFT_MAX_AGE_MS = 15 * 60 * 1000

const KEY = 'hospiwaste.weighing-draft'

/** Aviso a la página de Pesaje de que el borrador cambió desde afuera (foto recuperada). */
export const DRAFT_RESTORED_EVENT = 'hospiwaste:weighing-draft-restored'

export function isDraftRestorable(draft: WeighingDraft | null, now: number, activeSessionId: string | null): boolean {
  if (!draft || draft.v !== 1 || !activeSessionId) return false
  if (draft.weighingSessionId !== activeSessionId) return false
  return now - draft.savedAt <= DRAFT_MAX_AGE_MS
}

/** Borrador reciente, sin mirar la sesión: sirve para decidir volver a Pesaje al arrancar. */
export function isDraftFresh(draft: WeighingDraft | null, now: number): boolean {
  return !!draft && draft.v === 1 && now - draft.savedAt <= DRAFT_MAX_AGE_MS
}

export function applyRestoredPhoto(draft: WeighingDraft, dataUrl: string, now: number): WeighingDraft {
  if (!draft.cameraSlot) return draft
  return {
    ...draft,
    savedAt: now,
    cameraSlot: null,
    form: { ...draft.form, [draft.cameraSlot]: dataUrl },
  }
}

export function isDraftWorthSaving(form: WeighingFormState, editingReceptionId: string | null): boolean {
  if (editingReceptionId) return true
  return (Object.keys(EMPTY_WEIGHING_FORM) as (keyof WeighingFormState)[])
    .some((k) => form[k] !== EMPTY_WEIGHING_FORM[k])
}

// ── Persistencia (Preferences; en web cae a localStorage) ───────────────────
// Nunca lanza: un borrador que no se pudo guardar o leer no debe romper el pesaje.

export async function saveDraft(draft: WeighingDraft): Promise<void> {
  try {
    const { Preferences } = await import('@capacitor/preferences')
    await Preferences.set({ key: KEY, value: JSON.stringify(draft) })
  } catch (err) {
    console.error('[weighing-draft] guardar falló:', err)
  }
}

export async function loadDraft(): Promise<WeighingDraft | null> {
  try {
    const { Preferences } = await import('@capacitor/preferences')
    const { value } = await Preferences.get({ key: KEY })
    return value ? (JSON.parse(value) as WeighingDraft) : null
  } catch (err) {
    console.error('[weighing-draft] leer falló:', err)
    return null
  }
}

export async function clearDraft(): Promise<void> {
  try {
    const { Preferences } = await import('@capacitor/preferences')
    await Preferences.remove({ key: KEY })
  } catch (err) {
    console.error('[weighing-draft] borrar falló:', err)
  }
}
