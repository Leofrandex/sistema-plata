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
