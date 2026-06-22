/**
 * @jest-environment jsdom
 */
import { renderHook, act } from '@testing-library/react'
import { useOperatorCountdown } from '@/hooks/use-operator-countdown'
import { useStore } from '@/lib/store'
import { setLoginAt, clearLoginAt, SESSION_DURATION_MS } from '@/lib/session-timeout'

beforeEach(() => {
  jest.useFakeTimers()
  localStorage.clear()
  clearLoginAt()
  useStore.getState().setCurrentRole(null)
})
afterEach(() => {
  jest.useRealTimers()
})

it('inactivo cuando el rol no es operador', () => {
  useStore.getState().setCurrentRole('coordinator')
  setLoginAt(Date.now())
  const { result } = renderHook(() => useOperatorCountdown())
  expect(result.current.active).toBe(false)
})

it('activo para operador con login_at y avanza con el tiempo', () => {
  const now = Date.now()
  jest.setSystemTime(now)
  useStore.getState().setCurrentRole('operator')
  setLoginAt(now)
  const { result } = renderHook(() => useOperatorCountdown())
  expect(result.current.active).toBe(true)
  expect(result.current.remainingMs).toBeLessThanOrEqual(SESSION_DURATION_MS)
  expect(result.current.isExpired).toBe(false)

  act(() => {
    jest.setSystemTime(now + SESSION_DURATION_MS + 1000)
    jest.advanceTimersByTime(1000)
  })
  expect(result.current.isExpired).toBe(true)
  expect(result.current.remainingMs).toBe(0)
})
