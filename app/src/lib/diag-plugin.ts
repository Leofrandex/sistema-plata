import { registerPlugin, Capacitor } from '@capacitor/core'

/**
 * Puente al plugin nativo `Diag` (app/android/.../diag/DiagPlugin.kt): expone
 * el último crash nativo capturado por `HospiwasteApp` (el
 * UncaughtExceptionHandler lo guarda en un archivo antes de que Android mate
 * el proceso). Sin esto, "la app se cierra sola" no deja ningún rastro que se
 * pueda leer desde planta.
 */
interface DiagPlugin {
  getLastCrash(): Promise<{ crash: string | null; at: number }>
  clearLastCrash(): Promise<void>
  getExitReasons(): Promise<{ exits: ExitReason[] }>
}

/** Un cierre del proceso según Android (ApplicationExitInfo, API 30+). */
export interface ExitReason {
  /** epoch ms */
  at: number
  /** LOW_MEMORY, CRASH, CRASH_NATIVE, ANR, SIGNALED, USER_REQUESTED, … */
  reason: string
  /** importancia del proceso al morir: 100 = primer plano, ≥ 400 = segundo plano */
  importance: number
  description: string
}

const Diag = registerPlugin<DiagPlugin>('Diag')

export interface LastCrash {
  crash: string
  /** epoch ms */
  at: number
}

/** null en web, si el plugin no está o si no hubo crash. Nunca lanza. */
export async function getLastCrash(): Promise<LastCrash | null> {
  if (!Capacitor.isNativePlatform()) return null
  try {
    const r = await Diag.getLastCrash()
    return r.crash ? { crash: r.crash, at: r.at } : null
  } catch {
    return null
  }
}

export async function clearLastCrash(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return
  try { await Diag.clearLastCrash() } catch { /* plugin ausente */ }
}

/**
 * Los últimos cierres de la app según Android. Si la app "vuelve al inicio" al
 * tomar una foto y acá aparece LOW_MEMORY en segundo plano, Android la mató
 * mientras la cámara estaba abierta. [] en web, API < 30 o si falla. Nunca lanza.
 */
export async function getExitReasons(): Promise<ExitReason[]> {
  if (!Capacitor.isNativePlatform()) return []
  try {
    return (await Diag.getExitReasons()).exits
  } catch {
    return []
  }
}
