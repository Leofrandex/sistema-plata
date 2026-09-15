const kv = new Map<string, string>()

const impl: Record<string, (arg: never) => Promise<unknown>> = {
  get: async ({ key }: { key: string }) => ({ value: kv.get(key) ?? null }),
  set: async ({ key, value }: { key: string; value: string }) => { kv.set(key, value) },
  remove: async ({ key }: { key: string }) => { kv.delete(key) },
} as never

/**
 * Mock **fiel** al proxy de plugin de Capacitor: responde con una función a
 * CUALQUIER propiedad, `then` incluida. Por eso el objeto del plugin es
 * thenable y no se puede devolver desde una función `async` — el motor lo
 * "desenvuelve" llamando a `.then()`, que en el bridge nativo no existe.
 *
 * El mock plano que había antes acá (un objeto literal, sin `then`) es la razón
 * por la que el bug del 2026-08-24 pasó los tests y se colgó en el APK: la
 * sesión no cargaba nunca y Pesaje quedaba en "Cargando tu sesión…".
 *
 * Diferencia deliberada con el dispositivo: allá el await queda colgado para
 * siempre; acá `then` rechaza para que el test falle rápido y con un mensaje
 * claro en vez de agotar el timeout de jest.
 */
const Preferences = new Proxy(impl, {
  get(target, prop: string) {
    if (prop in target) return target[prop]
    return (...args: unknown[]) => {
      const reject = args[1]
      const err = new Error(`"Preferences.${prop}()" is not implemented on android`)
      if (typeof reject === 'function') return (reject as (e: Error) => void)(err)
      return Promise.reject(err)
    }
  },
})

jest.mock('@capacitor/preferences', () => ({ Preferences }), { virtual: true })

import { preferencesStorageAdapter, touchActivity, isSessionExpired, INACTIVITY_LIMIT_MS } from '@hospiwaste/shared/lib/supabase/preferences-storage'

it('get/set/remove van a Preferences', async () => {
  await preferencesStorageAdapter.setItem('k', 'v')
  expect(await preferencesStorageAdapter.getItem('k')).toBe('v')
  await preferencesStorageAdapter.removeItem('k')
  expect(await preferencesStorageAdapter.getItem('k')).toBeNull()
})

it('sesión expira tras 1h de inactividad', async () => {
  await touchActivity()
  expect(await isSessionExpired()).toBe(false)
  kv.set('hospiwaste_last_activity_at', String(Date.now() - INACTIVITY_LIMIT_MS - 1000))
  expect(await isSessionExpired()).toBe(true)
})

it('sin actividad registrada no se considera expirada (primer login)', async () => {
  kv.delete('hospiwaste_last_activity_at')
  expect(await isSessionExpired()).toBe(false)
})

it('no trata al plugin como thenable (regresión: sesión colgada en el APK)', async () => {
  // Si el módulo devuelve el proxy del plugin desde una función `async`, este
  // getItem nunca resuelve (o revienta con "Preferences.then() is not
  // implemented"). Con el envoltorio, resuelve normal.
  kv.set('sb-auth-token', 'tok')
  await expect(preferencesStorageAdapter.getItem('sb-auth-token')).resolves.toBe('tok')
})
