import '@testing-library/jest-dom'

// Polyfill structuredClone for fake-indexeddb
if (typeof global.structuredClone === 'undefined') {
  global.structuredClone = (obj: any) => JSON.parse(JSON.stringify(obj))
}
