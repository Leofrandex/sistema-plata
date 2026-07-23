import { registerPlugin, Capacitor } from '@capacitor/core'

export interface NativeCredentialsState {
  hasCredentials: boolean
  /** epoch ms de la última rotación NATIVA del refresh token; 0 si el token vigente vino del handoff JS. */
  rotatedAt: number
  /** Presente solo si hay credenciales. Solo para re-adoptar la sesión en JS — nunca loguearlo. */
  refreshToken?: string
}

interface NativeSyncPlugin {
  setCredentials(opts: { url: string; anonKey: string; refreshToken: string }): Promise<void>
  getCredentials(): Promise<NativeCredentialsState>
  clearCredentials(): Promise<void>
  kick(): Promise<void>
}

const NativeSync = registerPlugin<NativeSyncPlugin>('NativeSync')

/** Entrega el refresh token al plugin nativo (EncryptedSharedPreferences) tras un login exitoso. No-op en web. */
export async function handOffCredentials(refreshToken: string): Promise<void> {
  if (!Capacitor.isNativePlatform()) return
  await NativeSync.setCredentials({
    url: process.env.NEXT_PUBLIC_SUPABASE_URL!,
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    refreshToken,
  })
}

/** Estado de credenciales nativas (C1). `null` en web o si el plugin no está disponible. */
export async function getNativeCredentials(): Promise<NativeCredentialsState | null> {
  if (!Capacitor.isNativePlatform()) return null
  try {
    return await NativeSync.getCredentials()
  } catch {
    return null // plugin ausente
  }
}

/** Solo borra si no quedan pendientes (decisión: la cola es del dispositivo). No-op en web. */
export async function clearCredentialsIfDrained(pendingTotal: number): Promise<void> {
  if (!Capacitor.isNativePlatform()) return
  if (pendingTotal === 0) await NativeSync.clearCredentials()
}

/** Arranca el sync nativo si hay pendientes. No-op en web; tolera plugin ausente. */
export async function kickNativeSync(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return
  try { await NativeSync.kick() } catch { /* plugin ausente en web */ }
}
