import 'fake-indexeddb/auto'
import { createIdbStore } from '@hospiwaste/shared/lib/local-store/idb-store'
import { flush, withTimeout, REQUEST_TIMEOUT_MS } from '@hospiwaste/shared/lib/local-store/sync-engine'
import type { LocalStore } from '@hospiwaste/shared/lib/local-store/types'

/** DB falso: registra upserts y permite fallar por tabla. */
function fakeDb(failOn: Record<string, string> = {}) {
  const upserts: Array<{ table: string; row: unknown }> = []
  const uploads: string[] = []
  return {
    upserts, uploads,
    from(table: string) {
      return {
        upsert: async (row: unknown) => {
          if (failOn[table] === 'network') return Promise.reject(new TypeError('Failed to fetch'))
          if (failOn[table]) return { error: { message: failOn[table] } }
          upserts.push({ table, row })
          return { error: null }
        },
      }
    },
    storage: {
      from: () => ({
        upload: async (path: string) => { uploads.push(path); return { error: null } },
      }),
    },
  } as never
}

async function freshStore(prefix: string): Promise<LocalStore> {
  const s = createIdbStore(`sync-${prefix}`)
  await s.init()
  return s
}

describe('flush', () => {
  it('sube en SYNC_ORDER, marca synced=1 y cuenta pushed', async () => {
    const s = await freshStore('a')
    await s.putRow('container_receptions', 'rec1', { id: 'rec1', weighing_session_id: 'wsA' })
    await s.putRow('weighing_sessions', 'wsA', { id: 'wsA' })
    const db = fakeDb()
    const r = await flush(db, s)
    expect(r.pushedRecords).toBe(2)
    expect((db as never as { upserts: Array<{ table: string }> }).upserts.map((u) => u.table))
      .toEqual(['weighing_sessions', 'container_receptions'])
    expect(await s.isRowSynced('weighing_sessions', 'wsA')).toBe(true)
  })

  it('una hija cuyo padre falló NO se sube en esta pasada', async () => {
    const s = await freshStore('b')
    await s.putRow('weighing_sessions', 'wsB', { id: 'wsB' })
    await s.putRow('container_receptions', 'recB', { id: 'recB', weighing_session_id: 'wsB' })
    const db = fakeDb({ weighing_sessions: 'RLS: rechazado' })
    const r = await flush(db, s)
    expect(r.failed).toBe(1)
    expect(await s.isRowSynced('container_receptions', 'recB')).toBe(false)
    const [ws] = await s.getRows('weighing_sessions')
    expect(ws.sync_error).toContain('rechazado')
  })

  it('las fotos solo suben cuando su registro padre está synced', async () => {
    const s = await freshStore('c')
    await s.putRow('route_events', 'reC', { id: 'reC' })
    await s.putPhoto({ photo_id: 'pC', event_type: 'route', event_id: 'reC', label: 'x',
      uploaded_by: null, taken_at: 't', role: null, ext: 'jpg', content_type: 'image/jpeg' },
      new Blob(['img']))
    const db = fakeDb()
    const r = await flush(db, s)
    expect(r.pushedRecords).toBe(1)
    expect(r.pushedPhotos).toBe(1)
    expect((db as never as { uploads: string[] }).uploads).toEqual(['route/reC/pC.jpg'])
    expect((await s.getUnsyncedPhotos())).toHaveLength(0)
  })

  it('error de red aborta la pasada sin contar intento; rechazo cuenta y sigue', async () => {
    const s = await freshStore('d')
    await s.putRow('route_events', 'reD', { id: 'reD' })
    const db = fakeDb({ route_events: 'network' })
    const r = await flush(db, s)
    expect(r.pushedRecords).toBe(0)
    const [row] = await s.getRows('route_events')
    expect(row.attempts).toBe(0) // red no cuenta intento
    expect(row.sync_error).toBeNull()
  })

  it('una foto sin fila padre local (histórico ya en server) sube igual', async () => {
    const s = await freshStore('f')
    await s.putPhoto({ photo_id: 'pF', event_type: 'route', event_id: 'reF-inexistente', label: 'x',
      uploaded_by: null, taken_at: 't', role: null, ext: 'jpg', content_type: 'image/jpeg' },
      new Blob(['img']))
    const db = fakeDb()
    const r = await flush(db, s)
    expect(r.pushedPhotos).toBe(1)
    expect((db as never as { uploads: string[] }).uploads).toEqual(['route/reF-inexistente/pF.jpg'])
  })

  it('una foto cuyo padre existe local y sigue unsynced NO sube', async () => {
    const s = await freshStore('g')
    const db = fakeDb({ route_events: 'RLS: rechazado' })
    await s.putRow('route_events', 'reG', { id: 'reG' })
    await s.putPhoto({ photo_id: 'pG', event_type: 'route', event_id: 'reG', label: 'x',
      uploaded_by: null, taken_at: 't', role: null, ext: 'jpg', content_type: 'image/jpeg' },
      new Blob(['img']))
    const r = await flush(db, s)
    expect(r.pushedPhotos).toBe(0)
    expect((db as never as { uploads: string[] }).uploads).toEqual([])
    expect((await s.getUnsyncedPhotos())).toHaveLength(1)
  })

  it('mutex: un flush concurrente retorna skipped', async () => {
    const s = await freshStore('e')
    await s.putRow('route_events', 'reE', { id: 'reE' })
    const slowDb = {
      from: () => ({ upsert: () => new Promise((res) => setTimeout(() => res({ error: null }), 50)) }),
      storage: { from: () => ({ upload: async () => ({ error: null }) }) },
    } as never
    const [a, b] = await Promise.all([flush(slowDb, s), flush(slowDb, s)])
    expect([a.skipped, b.skipped].filter(Boolean)).toHaveLength(1)
  })
})

describe('withTimeout', () => {
  it('rechaza como error de red al expirar', async () => {
    await expect(withTimeout(new Promise(() => {}), 10)).rejects.toThrow(/timeout/i)
  })
  it('REQUEST_TIMEOUT_MS = 15000', () => {
    expect(REQUEST_TIMEOUT_MS).toBe(15_000)
  })
})
