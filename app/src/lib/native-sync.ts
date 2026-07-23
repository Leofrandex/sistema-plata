import { registerPlugin, Capacitor } from '@capacitor/core'

interface NativeSyncPlugin {
  setCredentials(opts: { url: string; anonKey: string; refreshToken: string }): Promise<void>
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
