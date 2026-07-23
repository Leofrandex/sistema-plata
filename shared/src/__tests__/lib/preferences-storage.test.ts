const kv = new Map<string, string>()
jest.mock('@capacitor/preferences', () => ({
  Preferences: {
    get: async ({ key }: { key: string }) => ({ value: kv.get(key) ?? null }),
    set: async ({ key, value }: { key: string; value: string }) => { kv.set(key, value) },
    remove: async ({ key }: { key: string }) => { kv.delete(key) },
  },
}), { virtual: true })

import { preferencesStorageAdapter, touchActivity, isSessionExpired, INACTIVITY_LIMIT_MS } from '@hospiwaste/shared/lib/supabase/preferences-storage'

it('get/set/remove van a Preferences', async () => {
  await preferencesStorageAdapter.setItem('k', 'v')
  expect(await preferencesStorageAdapter.getItem('k')).toBe('v')
  await preferencesStorageAdapter.removeItem('k')
  expect(await preferencesStorageAdapter.getItem('k')).toBeNull()
})

it('sesión expira tras 1h de inactividad', async () => {
  await touchActivity()
  expect(await isSessionExpired()).toBe(false)
  kv.set('hospiwaste_last_activity_at', String(Date.now() - INACTIVITY_LIMIT_MS - 1000))
  expect(await isSessionExpired()).toBe(true)
})

it('sin actividad registrada no se considera expirada (primer login)', async () => {
  kv.delete('hospiwaste_last_activity_at')
  expect(await isSessionExpired()).toBe(false)
})
