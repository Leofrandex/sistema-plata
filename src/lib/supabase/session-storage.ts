/**
 * Storage para la sesión de Supabase respaldado en `window.sessionStorage`:
 * sobrevive recargas de página y se borra al cerrar la pestaña o destruir el
 * WebView (semántica de "cookie de sesión"). Fallback en memoria cuando no hay
 * `window` (no debería ocurrir en export estático, pero evita romper en SSR).
 */
const memory = new Map<string, string>()

export const sessionStorageAdapter = {
  getItem(key: string): string | null {
    if (typeof window === 'undefined') return memory.get(key) ?? null
    return window.sessionStorage.getItem(key)
  },
  setItem(key: string, value: string): void {
    if (typeof window === 'undefined') { memory.set(key, value); return }
    window.sessionStorage.setItem(key, value)
  },
  removeItem(key: string): void {
    if (typeof window === 'undefined') { memory.delete(key); return }
    window.sessionStorage.removeItem(key)
  },
}
