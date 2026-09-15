/**
 * Chequeos de diagnóstico del APK, pensados para correr en planta sin cable
 * ni consola: cada uno devuelve una línea que se puede leer en una captura de
 * pantalla. Reemplaza al "adiviná qué falla" de los reportes de campo.
 *
 * Cada chequeo aísla UNA capa: red del sistema, DNS/servidor propio, un host
 * de control (para distinguir "sin internet" de "solo nuestro servidor falla"),
 * sesión, plugins nativos (Preferences, SQLite) y último crash nativo.
 */
import { describeError } from '@hospiwaste/shared/lib/describe-error'

export type CheckStatus = 'ok' | 'fail' | 'warn' | 'info'

export interface CheckResult {
  label: string
  status: CheckStatus
  detail: string
}

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
export const HEALTH_URL = `${SUPABASE_URL}/auth/v1/health`
/** El gateway de Supabase responde 401 "No API key found" sin este header. Ese
 *  401 ya prueba que el servidor está alcanzable, pero con la clave da 200 y
 *  el informe no confunde a nadie. */
export const HEALTH_INIT: RequestInit = {
  headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '' },
}
/** Host de control ajeno a nosotros: si este responde y el nuestro no, el
 *  problema es específico (DNS/bloqueo del host), no falta de internet. */
export const CONTROL_URL = 'https://www.google.com/generate_204'
export const FETCH_TIMEOUT_MS = 10_000
export const CRASH_LABEL = 'Último cierre inesperado'

export function hostOf(url: string): string {
  try { return new URL(url).host } catch { return url }
}

/** fetch con tiempo límite; devuelve estado HTTP y latencia, o el error legible. */
export async function probe(url: string, init: RequestInit = {}): Promise<CheckResult> {
  const started = Date.now()
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(new Error(`timeout tras ${FETCH_TIMEOUT_MS}ms`)), FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal, cache: 'no-store' })
    const ms = Date.now() - started
    // `no-cors` devuelve status 0 (opaco) aunque haya respondido: llegar ya es éxito.
    if (res.type === 'opaque') return { label: hostOf(url), status: 'ok', detail: `respondió en ${ms} ms` }
    // Cualquier respuesta HTTP prueba que el servidor está alcanzable (DNS, TLS y
    // ruta OK). Un 4xx es "responde pero rechaza" (aviso), un 5xx sí es fallo.
    const status: CheckStatus = res.ok ? 'ok' : res.status < 500 ? 'warn' : 'fail'
    return {
      label: hostOf(url),
      status,
      detail: res.ok ? `HTTP ${res.status} en ${ms} ms`
        : `servidor alcanzable pero respondió HTTP ${res.status} en ${ms} ms`,
    }
  } catch (err) {
    return { label: hostOf(url), status: 'fail', detail: describeError(err) }
  } finally {
    clearTimeout(t)
  }
}

/** Texto plano del informe para copiar/pegar en un chat. */
export function formatReport(header: string[], results: CheckResult[]): string {
  const icon: Record<CheckStatus, string> = { ok: 'OK ', fail: 'FALLO', warn: 'AVISO', info: 'i' }
  return [
    ...header,
    '',
    ...results.map((r) => `[${icon[r.status]}] ${r.label}: ${r.detail}`),
  ].join('\n')
}

/** Resumen en una frase, para que quien lee la captura sepa qué mirar primero. */
export function summarize(results: CheckResult[]): string {
  const by = (label: string) => results.find((r) => r.label === label)
  const own = by(hostOf(HEALTH_URL))
  const control = by(hostOf(CONTROL_URL))
  const crash = by(CRASH_LABEL)
  if (crash?.status === 'fail') return 'La app se cerró por un error nativo la última vez. Mandá este informe.'
  if (own?.status === 'fail' && control?.status === 'ok')
    return 'Hay internet, pero el servidor de Hospiwaste no es alcanzable desde esta red. Probá DNS privado (dns.google) o cambiar de red.'
  if (own?.status === 'fail' && control?.status === 'fail') return 'Este teléfono no tiene salida a internet ahora mismo.'
  const native = results.filter((r) => r.status === 'fail' && /Preferences|SQLite/.test(r.label))
  if (native.length) return 'Falla un componente nativo del teléfono. Mandá este informe.'
  if (own?.status === 'ok') return 'Servidor alcanzable. Si el problema sigue, mandá este informe igual.'
  return ''
}
