import { sessionStorageAdapter } from '@hospiwaste/shared/lib/supabase/session-storage'

describe('sessionStorageAdapter', () => {
  beforeEach(() => window.sessionStorage.clear())

  it('persiste y lee un valor', () => {
    sessionStorageAdapter.setItem('k', 'v')
    expect(sessionStorageAdapter.getItem('k')).toBe('v')
  })

  it('devuelve null para una clave ausente', () => {
    expect(sessionStorageAdapter.getItem('missing')).toBeNull()
  })

  it('elimina un valor', () => {
    sessionStorageAdapter.setItem('k', 'v')
    sessionStorageAdapter.removeItem('k')
    expect(sessionStorageAdapter.getItem('k')).toBeNull()
  })
})
