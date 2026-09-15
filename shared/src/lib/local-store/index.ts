import type { LocalStore } from './types'

export * from './types'

let instance: Promise<LocalStore> | null = null

/**
 * LocalStore de la plataforma: SQLite+Filesystem en APK, IndexedDB en web/dev.
 *
 * Singleton, pero **no cachea un rechazo**: si `init()` falla (plugin nativo,
 * base corrupta, conexión duplicada), la siguiente llamada vuelve a intentar.
 * Antes, un fallo al arrancar dejaba la promesa rechazada cacheada y el botón
 * "Reintentar" del banner fallaba para siempre sin decir por qué.
 */
export function getLocalStore(): Promise<LocalStore> {
  if (!instance) {
    instance = (async () => {
      let native = false
      try {
        const { Capacitor } = await import('@capacitor/core')
        native = Capacitor.isNativePlatform()
      } catch { /* jest/web sin capacitor */ }
      const store = native
        ? (await import('./sqlite-store')).createSqliteStore()
        : (await import('./idb-store')).createIdbStore()
      await store.init()
      return store
    })()
    instance.catch(() => { instance = null })
  }
  return instance
}
