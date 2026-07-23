import type { LocalStore } from './types'

export * from './types'

let instance: Promise<LocalStore> | null = null

/** LocalStore de la plataforma: SQLite+Filesystem en APK, IndexedDB en web/dev. */
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
  }
  return instance
}
