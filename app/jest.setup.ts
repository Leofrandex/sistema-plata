import '@testing-library/jest-dom'

// Polyfill structuredClone for fake-indexeddb.
// jsdom has no native structuredClone, and fake-indexeddb v6 calls it on
// every put(). A JSON.stringify-based polyfill silently corrupts Blobs
// (they serialize to "{}"), so this does a manual deep clone that passes
// Blob instances through by reference instead (Blobs are immutable, so a
// shared reference is structured-clone-equivalent for test purposes).
if (typeof globalThis.structuredClone !== 'function') {
  const deepClone = (value: any): any => {
    if (value === null || typeof value !== 'object') return value
    if (typeof Blob !== 'undefined' && value instanceof Blob) return value
    if (value instanceof Date) return new Date(value.getTime())
    if (value instanceof Map) {
      return new Map(Array.from(value, ([k, v]) => [deepClone(k), deepClone(v)]))
    }
    if (value instanceof Set) {
      return new Set(Array.from(value, (v) => deepClone(v)))
    }
    if (Array.isArray(value)) return value.map((item) => deepClone(item))
    const cloned: Record<string, any> = {}
    for (const key of Object.keys(value)) {
      cloned[key] = deepClone(value[key])
    }
    return cloned
  }
  globalThis.structuredClone = deepClone
}

// jsdom no implementa crypto.subtle ni TextEncoder (sí crypto.randomUUID).
// El WebView real sí los tiene: Capacitor sirve en https://localhost, que es
// secure context. Sin esto, uuidV5 revienta solo en los tests.
if (typeof globalThis.crypto?.subtle === 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { webcrypto } = require('node:crypto')
  Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true })
}
if (typeof globalThis.TextEncoder === 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { TextEncoder } = require('node:util')
  Object.defineProperty(globalThis, 'TextEncoder', { value: TextEncoder, configurable: true })
}
