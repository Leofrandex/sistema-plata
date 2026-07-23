/**
 * Storage de sesión Supabase sobre `@capacitor/preferences`: sobrevive al
 * cierre del WebView (a diferencia de `sessionStorageAdapter`). Solo se usa
 * en plataforma nativa (ver `client.ts`). La sesión expira exclusivamente por
 * inactividad de 1h — política de teléfonos compartidos entre operadores —
 * chequeada al arrancar y al volver a foreground (ver `app-lifecycle.tsx`).
 */
export const INACTIVITY_LIMIT_MS = 3_600_000 // 1 h — política de teléfonos compartidos
const ACTIVITY_KEY = 'hospiwaste_last_activity_at'

async function prefs() {
  const { Preferences } = await import('@capacitor/preferences')
  return Preferences
}

/** Storage de sesión Supabase sobre Preferences: sobrevive al cierre del WebView. */
export const preferencesStorageAdapter = {
  async getItem(key: string): Promise<string | null> {
    return (await (await prefs()).get({ key })).value
  },
  async setItem(key: string, value: string): Promise<void> {
    await (await prefs()).set({ key, value })
  },
  async removeItem(key: string): Promise<void> {
    await (await prefs()).remove({ key })
  },
}

export async function touchActivity(): Promise<void> {
  await (await prefs()).set({ key: ACTIVITY_KEY, value: String(Date.now()) })
}

/** true solo si hubo actividad registrada y pasó más de 1 h. */
export async function isSessionExpired(): Promise<boolean> {
  const { value } = await (await prefs()).get({ key: ACTIVITY_KEY })
  if (!value) return false
  return Date.now() - Number(value) > INACTIVITY_LIMIT_MS
}
