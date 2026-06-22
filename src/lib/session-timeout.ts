/**
 * Lógica pura del auto-logout de operadores. El corte es ABSOLUTO: 60 min desde
 * el login (no se reinicia por actividad). El ancla `login_at` vive en
 * localStorage para sobrevivir recargas de la app dentro de la hora.
 */
export const SESSION_DURATION_MS = 60 * 60 * 1000
export const WARNING_MS = 5 * 60 * 1000
export const LOGIN_AT_KEY = 'hospiwaste:login_at'

export interface OperatorSessionState {
  remainingMs: number
  isWarning: boolean
  isExpired: boolean
}

export function computeSessionState(
  loginAt: number,
  now: number,
  durationMs: number = SESSION_DURATION_MS,
  warningMs: number = WARNING_MS
): OperatorSessionState {
  const remainingMs = Math.max(0, loginAt + durationMs - now)
  return {
    remainingMs,
    isWarning: remainingMs > 0 && remainingMs <= warningMs,
    isExpired: remainingMs <= 0,
  }
}

/** Formatea milisegundos restantes como "m:ss" (redondea segundos hacia arriba). */
export function formatRemaining(ms: number): string {
  const totalSec = Math.ceil(Math.max(0, ms) / 1000)
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export function setLoginAt(ts: number = Date.now()): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(LOGIN_AT_KEY, String(ts))
}

export function getLoginAt(): number | null {
  if (typeof window === 'undefined') return null
  const raw = localStorage.getItem(LOGIN_AT_KEY)
  if (raw === null) return null
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
}

export function clearLoginAt(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(LOGIN_AT_KEY)
}
