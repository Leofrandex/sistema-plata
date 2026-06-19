/**
 * @jest-environment jsdom
 */
import {
  computeSessionState,
  formatRemaining,
  setLoginAt,
  getLoginAt,
  clearLoginAt,
  SESSION_DURATION_MS,
  WARNING_MS,
} from '@/lib/session-timeout'

describe('computeSessionState', () => {
  it('al inicio queda lejos del aviso y no expirado', () => {
    const loginAt = 1_000_000
    const s = computeSessionState(loginAt, loginAt)
    expect(s.remainingMs).toBe(SESSION_DURATION_MS)
    expect(s.isWarning).toBe(false)
    expect(s.isExpired).toBe(false)
  })

  it('entra en aviso dentro de los últimos 5 min', () => {
    const loginAt = 1_000_000
    const now = loginAt + SESSION_DURATION_MS - WARNING_MS + 1000
    const s = computeSessionState(loginAt, now)
    expect(s.isWarning).toBe(true)
    expect(s.isExpired).toBe(false)
  })

  it('expira y clampa el restante a 0', () => {
    const loginAt = 1_000_000
    const s = computeSessionState(loginAt, loginAt + SESSION_DURATION_MS + 5000)
    expect(s.remainingMs).toBe(0)
    expect(s.isWarning).toBe(false)
    expect(s.isExpired).toBe(true)
  })
})

describe('formatRemaining', () => {
  it('formatea mm:ss redondeando hacia arriba', () => {
    expect(formatRemaining(0)).toBe('0:00')
    expect(formatRemaining(59_400)).toBe('1:00') // 59.4s → ceil 60s
    expect(formatRemaining(305_000)).toBe('5:05')
  })
})

describe('storage helpers', () => {
  beforeEach(() => localStorage.clear())

  it('set/get/clear de login_at', () => {
    expect(getLoginAt()).toBeNull()
    setLoginAt(1_234_567)
    expect(getLoginAt()).toBe(1_234_567)
    clearLoginAt()
    expect(getLoginAt()).toBeNull()
  })

  it('getLoginAt devuelve null ante valor corrupto', () => {
    localStorage.setItem('hospiwaste:login_at', 'no-numero')
    expect(getLoginAt()).toBeNull()
  })
})
