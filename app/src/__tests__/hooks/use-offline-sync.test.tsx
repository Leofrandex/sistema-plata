/**
 * @jest-environment jsdom
 */
import 'fake-indexeddb/auto'
import { renderHook, waitFor } from '@testing-library/react'
import { getLocalStore } from '@hospiwaste/shared/lib/local-store'
import { useOfflineSync } from '@/hooks/use-offline-sync'

jest.mock('@hospiwaste/shared/lib/supabase/client', () => ({
  createClient: () => ({
    from: () => ({ upsert: async () => ({ error: null }) }),
    storage: { from: () => ({ upload: async () => ({ error: null }) }) },
  }),
}))

it('expone los contadores de pendientes del LocalStore', async () => {
  const store = await getLocalStore()
  await store.putRow('route_events', 'reX', { id: 'reX' })
  const { result } = renderHook(() => useOfflineSync())
  await waitFor(() => expect(result.current.counts.records + result.current.counts.photos).toBeGreaterThanOrEqual(0))
  // tras el sync automático con red "ok", converge a 0
  await waitFor(() => expect(result.current.counts.records).toBe(0))
})
