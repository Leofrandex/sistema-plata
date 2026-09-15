/**
 * Storage de sesión Supabase sobre `@capacitor/preferences`: sobrevive al
 * cierre del WebView (a diferencia de `sessionStorageAdapter`). Solo se usa
 * en plataforma nativa (ver `client.ts`). La sesión expira exclusivamente por
 * inactividad de 1h — política de teléfonos compartidos entre operadores —
 * chequeada al arrancar y al volver a foreground (ver `app-lifecycle.tsx`).
 */
export const INACTIVITY_LIMIT_MS = 3_600_000 // 1 h — política de teléfonos compartidos
const ACTIVITY_KEY = 'hospiwaste_last_activity_at'

/**
 * Devuelve el plugin **envuelto en un objeto**. Nunca devolver `Preferences`
 * pelado desde una función `async`: el proxy de plugin de Capacitor responde
 * con una función a cualquier propiedad que se le pida, `then` incluida, así
 * que el motor lo trata como thenable y lo "desenvuelve" llamando a
 * `Preferences.then(resolve, reject)` — un método que el bridge nativo no
 * implementa. El await entonces no resuelve nunca y toda la sesión del APK
 * queda muerta (Pesaje colgado en "Cargando tu sesión…").
 * El envoltorio no es thenable, así que el await lo devuelve tal cual.
 */
async function prefs() {
  const { Preferences } = await import('@capacitor/preferences')
  return { p: Preferences }
}

/** Storage de sesión Supabase sobre Preferences: sobrevive al cierre del WebView. */
export const preferencesStorageAdapter = {
  async getItem(key: string): Promise<string | null> {
    return (await (await prefs()).p.get({ key })).value
  },
  async setItem(key: string, value: string): Promise<void> {
    await (await prefs()).p.set({ key, value })
  },
  async removeItem(key: string): Promise<void> {
    await (await prefs()).p.remove({ key })
  },
}

export async function touchActivity(): Promise<void> {
  await (await prefs()).p.set({ key: ACTIVITY_KEY, value: String(Date.now()) })
}

/** true solo si hubo actividad registrada y pasó más de 1 h. */
export async function isSessionExpired(): Promise<boolean> {
  const { value } = await (await prefs()).p.get({ key: ACTIVITY_KEY })
  if (!value) return false
  return Date.now() - Number(value) > INACTIVITY_LIMIT_MS
}
