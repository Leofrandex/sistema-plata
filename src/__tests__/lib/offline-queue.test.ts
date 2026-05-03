/**
 * @jest-environment node
 */
import { enqueue, dequeueAll, clearAll } from '@/lib/offline-queue'
import 'fake-indexeddb/auto'

describe('offline-queue', () => {
  beforeEach(async () => {
    await clearAll()
  })

  it('enqueues and dequeues items', async () => {
    await enqueue({ type: 'weighing', payload: { container_id: 'A-001', gross_weight_kg: 43.7 } })
    await enqueue({ type: 'storage', payload: { container_id: 'A-001' } })

    const items = await dequeueAll()
    expect(items).toHaveLength(2)
    expect(items[0].type).toBe('weighing')
    expect(items[1].type).toBe('storage')
  })

  it('clearAll removes all items', async () => {
    await enqueue({ type: 'weighing', payload: { container_id: 'A-001', gross_weight_kg: 43.7 } })
    await clearAll()
    const items = await dequeueAll()
    expect(items).toHaveLength(0)
  })
})
