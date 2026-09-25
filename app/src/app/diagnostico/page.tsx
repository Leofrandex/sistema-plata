'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { CheckCircle2, XCircle, AlertTriangle, Info, RefreshCw, Copy, ChevronLeft } from 'lucide-react'
import { createClient } from '@hospiwaste/shared/lib/supabase/client'
import { getLocalStore } from '@hospiwaste/shared/lib/local-store'
import { getConnected } from '@hospiwaste/shared/lib/net-status'
import { describeError } from '@hospiwaste/shared/lib/describe-error'
import { cn } from '@hospiwaste/shared/lib/utils'
import {
  CONTROL_URL, CRASH_LABEL, HEALTH_INIT, HEALTH_URL, SUPABASE_URL,
  formatReport, hostOf, probe, summarize, type CheckResult, type CheckStatus,
} from '@/lib/diagnostics'
import { clearLastCrash, getExitReasons, getLastCrash } from '@/lib/diag-plugin'

/**
 * Pantalla de diagnóstico de campo. Pública (sin sesión): justamente hace
 * falta cuando la app no puede iniciar sesión. Corre los chequeos de
 * `lib/diagnostics.ts` y arma un informe copiable.
 */
export default function DiagnosticoPage() {
  const [header, setHeader] = useState<string[]>([])
  const [results, setResults] = useState<CheckResult[]>([])
  const [running, setRunning] = useState(false)
  const [copied, setCopied] = useState(false)

  const run = useCallback(async () => {
    setRunning(true)
    setCopied(false)
    const out: CheckResult[] = []
    const push = (r: CheckResult) => { out.push(r); setResults([...out]) }

    // ── Cabecera: versión, dispositivo ──────────────────────────────────
    const head: string[] = [`Hospiwaste app · ${new Date().toLocaleString('es-VE')}`]
    try {
      const { Capacitor } = await import('@capacitor/core')
      if (Capacitor.isNativePlatform()) {
        const { App } = await import('@capacitor/app')
        const info = await App.getInfo()
        head.push(`Versión ${info.version} (build ${info.build})`)
      } else {
        head.push('Plataforma: web')
      }
    } catch (err) {
      head.push(`Versión: no disponible (${describeError(err)})`)
    }
    head.push(`Dispositivo: ${navigator.userAgent}`)
    head.push(`Servidor: ${hostOf(SUPABASE_URL) || '(sin NEXT_PUBLIC_SUPABASE_URL)'}`)
    setHeader(head)
    setResults([])

    // ── 0. Último crash nativo ──────────────────────────────────────────
    const crash = await getLastCrash()
    push(crash
      ? { label: CRASH_LABEL, status: 'fail', detail: `${new Date(crash.at).toLocaleString('es-VE')} · ${crash.crash}` }
      : { label: CRASH_LABEL, status: 'info', detail: 'ninguno registrado' })

    // ── 0b. Por qué Android cerró la app las últimas veces ─────────────
    const exits = await getExitReasons()
    push(exits.length
      ? {
          label: 'Últimos cierres de la app (Android)',
          status: exits.some((e) => e.reason === 'LOW_MEMORY' || e.reason.startsWith('CRASH')) ? 'warn' : 'info',
          detail: exits
            .map((e) => `${new Date(e.at).toLocaleString('es-VE')} · ${e.reason}${e.importance >= 400 ? ' (en segundo plano)' : ''}`)
            .join(' | '),
        }
      : { label: 'Últimos cierres de la app (Android)', status: 'info', detail: 'sin datos (Android < 11 o sin cierres)' })

    // ── 1. Red según el sistema ─────────────────────────────────────────
    try {
      const c = await getConnected()
      push({
        label: 'Red (según Android)',
        status: c ? 'ok' : 'warn',
        detail: c ? 'conectado y validado' : 'sin red validada (Android no pudo confirmar internet; puede ser DNS o portal cautivo)',
      })
    } catch (err) {
      push({ label: 'Red (según Android)', status: 'fail', detail: describeError(err) })
    }

    // ── 2. Nuestro servidor y un host de control, en paralelo ───────────
    const [own, control] = await Promise.all([
      probe(HEALTH_URL, HEALTH_INIT),
      probe(CONTROL_URL, { mode: 'no-cors' }),
    ])
    push(own)
    push(control)

    // ── 3. Sesión guardada ──────────────────────────────────────────────
    try {
      const { data, error } = await createClient().auth.getSession()
      if (error) push({ label: 'Sesión', status: 'warn', detail: describeError(error) })
      else if (data.session) {
        const exp = data.session.expires_at ? new Date(data.session.expires_at * 1000) : null
        push({
          label: 'Sesión',
          status: 'ok',
          detail: `${data.session.user.email ?? data.session.user.id}${exp ? ` · token vence ${exp.toLocaleString('es-VE')}` : ''}`,
        })
      } else push({ label: 'Sesión', status: 'warn', detail: 'no hay sesión guardada (o venció y no se pudo renovar sin servidor)' })
    } catch (err) {
      push({ label: 'Sesión', status: 'fail', detail: describeError(err) })
    }

    // ── 4. Plugins nativos: Preferences y SQLite ────────────────────────
    try {
      const { Capacitor } = await import('@capacitor/core')
      if (Capacitor.isNativePlatform()) {
        const { Preferences } = await import('@capacitor/preferences')
        const key = 'hw-diag-probe'
        const started = Date.now()
        await Preferences.set({ key, value: '1' })
        const { value } = await Preferences.get({ key })
        await Preferences.remove({ key })
        push({ label: 'Preferences', status: value === '1' ? 'ok' : 'fail', detail: `ida y vuelta en ${Date.now() - started} ms` })
      } else {
        push({ label: 'Preferences', status: 'info', detail: 'no aplica en web' })
      }
    } catch (err) {
      push({ label: 'Preferences', status: 'fail', detail: describeError(err) })
    }
    try {
      const started = Date.now()
      const counts = await (await getLocalStore()).pendingCounts()
      push({
        label: 'SQLite / cola local',
        status: 'ok',
        detail: `abre en ${Date.now() - started} ms · ${counts.records} registros y ${counts.photos} fotos pendientes, ${counts.rejected} rechazados`,
      })
    } catch (err) {
      push({ label: 'SQLite / cola local', status: 'fail', detail: describeError(err) })
    }

    // ── 5. Hora del teléfono (un reloj muy corrido rompe TLS y los JWT) ──
    push({ label: 'Hora del teléfono', status: 'info', detail: new Date().toISOString() })

    setRunning(false)
  }, [])

  useEffect(() => { run() }, [run])

  const report = formatReport(header, results)
  const summary = running ? '' : summarize(results)

  async function copy() {
    try {
      await navigator.clipboard.writeText(report)
      setCopied(true)
    } catch {
      // WebViews viejos sin clipboard API: el textarea de abajo sigue siendo seleccionable.
      setCopied(false)
    }
  }

  async function openConsole() {
    localStorage.setItem('hw-debug', '1')
    const mod = await import('eruda')
    mod.default.init()
  }

  async function forgetCrash() {
    await clearLastCrash()
    run()
  }

  return (
    <div className="space-y-4 pb-8">
      <Link href="/" className="flex items-center gap-1 text-sm text-muted-foreground">
        <ChevronLeft className="h-4 w-4" /> Volver
      </Link>
      <div>
        <h1 className="text-lg font-bold text-foreground">Diagnóstico</h1>
        <p className="text-sm text-muted-foreground">
          Sacá una captura de esta pantalla o tocá «Copiar informe» y pegalo en el chat.
        </p>
      </div>

      {summary && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900 ring-1 ring-amber-200">{summary}</p>
      )}

      <ul className="space-y-2">
        {results.map((r) => <Row key={r.label} r={r} />)}
        {running && (
          <li className="flex items-center gap-2 text-sm text-muted-foreground">
            <RefreshCw className="h-4 w-4 animate-spin" /> Ejecutando chequeos…
          </li>
        )}
      </ul>

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={run} disabled={running} className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60">
          Volver a correr
        </button>
        <button type="button" onClick={copy} disabled={running} className="flex items-center gap-1 rounded-md bg-muted px-3 py-2 text-sm font-medium text-foreground disabled:opacity-60">
          <Copy className="h-4 w-4" /> {copied ? 'Copiado' : 'Copiar informe'}
        </button>
        {results.some((r) => r.label === CRASH_LABEL && r.status === 'fail') && (
          <button type="button" onClick={forgetCrash} className="rounded-md bg-muted px-3 py-2 text-sm font-medium text-foreground">
            Olvidar crash
          </button>
        )}
        <button type="button" onClick={openConsole} className="rounded-md bg-muted px-3 py-2 text-sm font-medium text-muted-foreground">
          Abrir consola
        </button>
      </div>

      <textarea readOnly value={report} className="h-40 w-full rounded-md bg-muted p-2 font-mono text-[11px] text-foreground" />

      <div className="space-y-1 text-xs text-muted-foreground">
        <p>Cabecera del informe:</p>
        {header.map((h) => <p key={h} className="break-all">{h}</p>)}
      </div>
    </div>
  )
}

const ICON: Record<CheckStatus, { Icon: typeof CheckCircle2; cls: string }> = {
  ok:   { Icon: CheckCircle2,  cls: 'text-green-600' },
  fail: { Icon: XCircle,       cls: 'text-red-600' },
  warn: { Icon: AlertTriangle, cls: 'text-amber-600' },
  info: { Icon: Info,          cls: 'text-slate-400' },
}

function Row({ r }: { r: CheckResult }) {
  const { Icon, cls } = ICON[r.status]
  return (
    <li className="flex gap-2 rounded-lg bg-card p-3 ring-1 ring-foreground/10">
      <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', cls)} />
      <div className="min-w-0">
        <p className="text-sm font-semibold text-foreground">{r.label}</p>
        <p className="break-words text-xs text-muted-foreground">{r.detail}</p>
      </div>
    </li>
  )
}
