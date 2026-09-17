/**
 * @jest-environment jsdom
 */

/**
 * `getLocalStore()` en nativo: la conexión SQLite vive en el plugin nativo, que
 * sobrevive a una recarga del WebView dentro del mismo proceso. Si el JS
 * vuelve a pedir `createConnection`, el nativo lanza
 * "Connection hospiwaste already exists" (verificado en
 * `CapacitorSQLite.java`), y como el singleton cacheaba la promesa rechazada,
 * "Reintentar" fallaba para siempre: franja ámbar al abrir sin salida.
 */
const native = { isConnection: false, failOpenOnce: false, failCreateWithAlreadyExists: false }
const calls: string[] = []

function pluginProxy<T extends object>(impl: T): T {
  return new Proxy(impl, {
    get(target, prop: string) {
      if (prop in target) return (target as Record<string, unknown>)[prop]
      return () => Promise.reject(new Error(`"${prop}()" is not implemented on android`))
    },
  })
}

jest.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => true } }), { virtual: true })

jest.mock('@capacitor-community/sqlite', () => {
  class FakeConn {
    async open() {
      calls.push('open')
      if (native.failOpenOnce) { native.failOpenOnce = false; throw new Error('database disk image is malformed') }
    }
    async query() { return { values: [{ journal_mode: 'wal', n: 0 }] } }
    async execute() { return { changes: { changes: 0 } } }
    async run() { return { changes: { changes: 0 } } }
  }
  class SQLiteConnection {
    async isConnection() { calls.push('isConnection'); return { result: native.isConnection } }
    async retrieveConnection() { calls.push('retrieveConnection'); return new FakeConn() }
    async closeConnection() {
      calls.push('closeConnection')
      native.isConnection = false
      native.failCreateWithAlreadyExists = false
    }
    async checkConnectionsConsistency() { calls.push('checkConnectionsConsistency'); return { result: true } }
    async createConnection() {
      calls.push('createConnection')
      if (native.failCreateWithAlreadyExists || native.isConnection) {
        throw new Error('Connection hospiwaste already exists')
      }
      native.isConnection = true
      return new FakeConn()
    }
  }
  return { CapacitorSQLite: pluginProxy({}), SQLiteConnection }
}, { virtual: true })

beforeEach(() => {
  jest.resetModules()
  native.isConnection = false
  native.failOpenOnce = false
  native.failCreateWithAlreadyExists = false
  calls.length = 0
})

it('reutiliza la conexión que el nativo ya tiene abierta en vez de fallar con "already exists"', async () => {
  native.isConnection = true // el WebView se recargó; el plugin nativo conserva la conexión
  const { getLocalStore } = await import('@hospiwaste/shared/lib/local-store')
  const store = await getLocalStore()
  expect(await store.pendingCounts()).toEqual({ records: 0, photos: 0, rejected: 0 })
  expect(calls).toContain('retrieveConnection')
  expect(calls).not.toContain('createConnection')
})

it('recupera y recrea la conexión si el nativo lanza "already exists" por desincronización de JS', async () => {
  // JS no tiene la conexión en su Map (isConnection = false), pero el nativo lanza already exists
  native.isConnection = false
  native.failCreateWithAlreadyExists = true
  const { getLocalStore } = await import('@hospiwaste/shared/lib/local-store')
  const store = await getLocalStore()
  expect(await store.pendingCounts()).toEqual({ records: 0, photos: 0, rejected: 0 })
  expect(calls).toContain('closeConnection')
  expect(calls).toContain('createConnection')
})

it('no cachea un rechazo: tras un fallo de apertura, la siguiente llamada vuelve a intentar', async () => {
  native.failOpenOnce = true
  const { getLocalStore } = await import('@hospiwaste/shared/lib/local-store')
  await expect(getLocalStore()).rejects.toThrow(/malformed/)
  const store = await getLocalStore() // "Reintentar"
  expect(await store.pendingCounts()).toEqual({ records: 0, photos: 0, rejected: 0 })
})
