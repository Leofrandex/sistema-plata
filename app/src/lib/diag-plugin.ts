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
