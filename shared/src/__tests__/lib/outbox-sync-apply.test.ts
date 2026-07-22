/**
 * @jest-environment node
 */
import 'fake-indexeddb/auto'
import { applyOp, isNetworkError } from '@hospiwaste/shared/lib/outbox-sync'
import { putPhotoBlob } from '@hospiwaste/shared/lib/offline-queue'
import type { OutboxOp } from '@hospiwaste/shared/lib/offline-queue'

// Mock mínimo del cliente Supabase: registra los upserts y simula Storage.
function makeDb() {
  const calls: { table: string; payload: unknown; onConflict?: string }[] = []
  const storage: { path: string; upsert?: boolean }[] = []
  const db = {
    from(table: string) {
      return {
        upsert(payload: unknown, opts?: { onConflict?: string }) {
          calls.push({ table, payload, onConflict: opts?.onConflict })
          return Promise.resolve({ error: null })
        },
      }
    },
    storage: {
      from() {
        return {
          upload(path: string, _blob: Blob, opts?: { upsert?: boolean }) {
            storage.push({ path, upsert: opts?.upsert })
            return Promise.resolve({ error: null })
          },
        }
      },
    },
  }
  return { db: db as unknown as Parameters<typeof applyOp>[0], calls, storage }
}

describe('applyOp', () => {
  it('upsert idempotente de una reception por id', async () => {
    const { db, calls } = makeDb()
    const op: OutboxOp = {
      op_id: 'o1', type: 'create_reception',
      payload: { id: 'r1', container_id: 'c1' }, deps: [], created_at: '', attempts: 0,
    }
    await applyOp(db, op)
    expect(calls).toHaveLength(1)
    expect(calls[0].table).toBe('container_receptions')
    expect(calls[0].onConflict).toBe('id')
  })

  it('add_route_containers hace upsert en la join table con onConflict compuesto', async () => {
    const { db, calls } = makeDb()
    const op: OutboxOp = {
      op_id: 'o2', type: 'add_route_containers',
      payload: { table: 'route_event_containers_dirty', rows: [{ route_event_id: 're1', container_id: 'c1' }] },
      deps: ['ev'], created_at: '', attempts: 0,
    }
    await applyOp(db, op)
    expect(calls[0].table).toBe('route_event_containers_dirty')
    expect(calls[0].onConflict).toBe('route_event_id,container_id')
  })

  it('upload_photo sube el blob a ruta determinística (upsert) y upserta la fila', async () => {
    const { db, calls, storage } = makeDb()
    await putPhotoBlob({ photo_id: 'p1', blob: new Blob(['x'], { type: 'image/jpeg' }), content_type: 'image/jpeg' })
    const op: OutboxOp = {
      op_id: 'o3', type: 'upload_photo',
      payload: { photo_id: 'p1', event_type: 'weighing', event_id: 'r1', label: 'L', uploaded_by: 'u1', taken_at: 't', role: null, ext: 'jpg' },
      deps: ['rec'], created_at: '', attempts: 0,
    }
    await applyOp(db, op)
    expect(storage[0].path).toBe('weighing/r1/p1.jpg')
    expect(storage[0].upsert).toBe(true)
    expect(calls[0].table).toBe('photos')
    expect(calls[0].onConflict).toBe('id')
  })
})

describe('isNetworkError', () => {
  it('detecta fallos de red por TypeError fetch', () => {
    expect(isNetworkError(new TypeError('Failed to fetch'))).toBe(true)
    expect(isNetworkError(new Error('duplicate key value'))).toBe(false)
  })
  it('NO clasifica como red un rechazo de servidor que contenga la palabra network', () => {
    expect(isNetworkError(new Error('network policy violation'))).toBe(false)
  })
})
