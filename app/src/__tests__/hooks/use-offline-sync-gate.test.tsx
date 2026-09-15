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

// El plugin de red dice "sin conexión" (en Android eso solo significa que la
// red no está VALIDADA por el chequeo de Google, cosa habitual en redes con
// DNS roto o portales cautivos), pero el fetch real funciona.
jest.mock('@hospiwaste/shared/lib/net-status', () => ({
  getConnected: async () => false,
  onConnectivityChange: async () => () => {},
}))

it('intenta subir la cola aunque la señal de conectividad diga que no hay red', async () => {
  const store = await getLocalStore()
  await store.putRow('route_events', 'reGate', { id: 'reGate' })
  const { result } = renderHook(() => useOfflineSync())
  // La fila tiene que salir del LocalStore (flush real), no solo del contador
  // inicial del hook, que arranca en cero antes de leer nada.
  await waitFor(async () => expect((await store.pendingCounts()).records).toBe(0))
  // La señal del plugin sigue alimentando el indicador visual.
  await waitFor(() => expect(result.current.isOnline).toBe(false))
})
