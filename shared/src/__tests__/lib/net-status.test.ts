/**
 * @jest-environment jsdom
 */

/**
 * Mocks fieles a Capacitor: el objeto de plugin es un `Proxy` que responde con
 * una función a cualquier propiedad, `then` incluida. Ver el bug del 2026-08-24
 * en `preferences-storage.ts` — un mock plano no reproduce esa trampa.
 */
function pluginProxy<T extends object>(impl: T): T {
  return new Proxy(impl, {
    get(target, prop: string) {
      if (prop in target) return (target as Record<string, unknown>)[prop]
      return (...args: unknown[]) => {
        const reject = args[1]
        const err = new Error(`"${prop}()" is not implemented on android`)
        if (typeof reject === 'function') return (reject as (e: Error) => void)(err)
        return Promise.reject(err)
      }
    },
  })
}

let native = true
let pluginConnected = true
let listener: ((s: { connected: boolean }) => void) | null = null
let removed = false

jest.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => native },
}), { virtual: true })

jest.mock('@capacitor/network', () => ({
  Network: pluginProxy({
    getStatus: async () => ({ connected: pluginConnected }),
    addListener: async (_e: string, cb: (s: { connected: boolean }) => void) => {
      listener = cb
      return { remove: async () => { removed = true } }
    },
  }),
}), { virtual: true })

import { getConnected, onConnectivityChange } from '@hospiwaste/shared/lib/net-status'

beforeEach(() => {
  native = true; pluginConnected = true; listener = null; removed = false
  Object.defineProperty(navigator, 'onLine', { value: true, configurable: true })
})

it('en nativo lee el estado del plugin, no navigator.onLine', async () => {
  // navigator.onLine miente (falso negativo típico del WebView en WiFi):
  // el plugin es la fuente de verdad.
  Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })
  pluginConnected = true
  expect(await getConnected()).toBe(true)
})

it('en nativo refleja la desconexión real del plugin', async () => {
  pluginConnected = false
  expect(await getConnected()).toBe(false)
})

it('en web cae a navigator.onLine', async () => {
  native = false
  Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })
  expect(await getConnected()).toBe(false)
})

it('en nativo se suscribe al plugin y devuelve un unsubscribe que lo quita', async () => {
  const seen: boolean[] = []
  const off = await onConnectivityChange((c) => seen.push(c))
  expect(listener).not.toBeNull()
  listener!({ connected: false })
  listener!({ connected: true })
  expect(seen).toEqual([false, true])
  off()
  await Promise.resolve()
  expect(removed).toBe(true)
})

it('en web se suscribe a los eventos online/offline', async () => {
  native = false
  const seen: boolean[] = []
  const off = await onConnectivityChange((c) => seen.push(c))
  window.dispatchEvent(new Event('offline'))
  window.dispatchEvent(new Event('online'))
  expect(seen).toEqual([false, true])
  off()
  window.dispatchEvent(new Event('offline'))
  expect(seen).toEqual([false, true]) // ya no escucha
})

describe('onConnectivityRestored', () => {
  it('solo avisa en la transición desconectado → conectado, no en cada evento "connected"', async () => {
    // El plugin nativo dispara networkStatusChange con connected:true en cada
    // onCapabilitiesChanged de Android (cambios de ancho de banda, etc.), no
    // solo cuando vuelve la red. Re-hidratar en cada uno es una tormenta.
    const { onConnectivityRestored } = await import('@hospiwaste/shared/lib/net-status')
    let restored = 0
    const off = await onConnectivityRestored(() => { restored++ })
    listener!({ connected: true })
    listener!({ connected: true })
    expect(restored).toBe(0)
    listener!({ connected: false })
    listener!({ connected: true })
    expect(restored).toBe(1)
    listener!({ connected: true })
    expect(restored).toBe(1)
    off()
  })
})
