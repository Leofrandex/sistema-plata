/**
 * @jest-environment jsdom
 */
import { render, act } from '@testing-library/react'
import { OperatorSessionGuard } from '@/components/layout/operator-session-guard'
import { useStore } from '@hospiwaste/shared/lib/store'
import { setLoginAt, getLoginAt, clearLoginAt } from '@hospiwaste/shared/lib/session-timeout'

// Mock next/navigation
const mockReplace = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
}))

const mockSignOut = jest.fn().mockResolvedValue(undefined)
jest.mock('@hospiwaste/shared/lib/supabase/client', () => ({
  createClient: () => ({ auth: { signOut: mockSignOut } }),
}))

beforeEach(() => {
  localStorage.clear()
  clearLoginAt()
  useStore.getState().setCurrentRole(null)
  mockReplace.mockClear()
  mockSignOut.mockClear()
})

describe('OperatorSessionGuard', () => {
  it('NO re-ancla login_at en la transición null→operator con ancla previa', async () => {
    // Simula una ancla colocada por el login real hace 10 min
    const originalLoginAt = Date.now() - 10 * 60 * 1000
    setLoginAt(originalLoginAt)

    // Monta con rol aún sin resolver (null, como ocurre en cada recarga)
    render(<OperatorSessionGuard />)

    // El ancla debe sobrevivir intacta mientras el rol es null
    expect(getLoginAt()).toBe(originalLoginAt)

    // El rol se resuelve a operator (hidratación async)
    await act(async () => {
      useStore.getState().setCurrentRole('operator')
    })

    // El ancla NO debe haberse re-creado con Date.now()
    expect(getLoginAt()).toBe(originalLoginAt)
  })

  it('coordinador resuelto limpia login_at', async () => {
    setLoginAt(Date.now() - 5 * 60 * 1000)

    render(<OperatorSessionGuard />)

    await act(async () => {
      useStore.getState().setCurrentRole('coordinator')
    })

    expect(getLoginAt()).toBeNull()
  })
})
