import { signOut } from '@/lib/auth/sign-out'

const mockSignOut = jest.fn().mockResolvedValue({ error: null })
jest.mock('../../lib/supabase/client', () => ({
  createClient: () => ({ auth: { signOut: mockSignOut } }),
}))
const mockClearLoginAt = jest.fn()
jest.mock('../../lib/session-timeout', () => ({ clearLoginAt: () => mockClearLoginAt() }))

describe('signOut', () => {
  beforeEach(() => { mockSignOut.mockClear(); mockClearLoginAt.mockClear() })

  it('cierra sesión en Supabase y limpia login_at', async () => {
    await signOut()
    expect(mockSignOut).toHaveBeenCalledTimes(1)
    expect(mockClearLoginAt).toHaveBeenCalledTimes(1)
  })
})
