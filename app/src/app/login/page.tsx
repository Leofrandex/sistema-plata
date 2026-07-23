'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@hospiwaste/shared/components/ui/button'
import { Input } from '@hospiwaste/shared/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@hospiwaste/shared/components/ui/card'
import { Eye, EyeOff, ChevronLeft } from 'lucide-react'
import { APP_NAME } from '@hospiwaste/shared/lib/constants'
import { createClient } from '@hospiwaste/shared/lib/supabase/client'
import { getLoginDirectory, type LoginDirectoryEntry } from '@hospiwaste/shared/lib/supabase/queries'
import { setLoginAt } from '@hospiwaste/shared/lib/session-timeout'
import { handOffCredentials } from '@/lib/native-sync'

function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?'
}

function LoginForm() {
  const router = useRouter()
  const params = useSearchParams()
  const nextPath = params.get('next') || '/'

  const [directory, setDirectory] = useState<LoginDirectoryEntry[] | null>(null)
  const [selected, setSelected] = useState<LoginDirectoryEntry | null>(null)
  const [manual, setManual] = useState(false) // fallback de correo
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [directoryError, setDirectoryError] = useState(false)

  useEffect(() => {
    let cancelled = false
    // Timeout: sin red, la consulta de usuarios se colgaría en "Cargando…" para
    // siempre. A los 8s caemos al fallback de correo con aviso de sin conexión.
    const timer = setTimeout(() => {
      if (!cancelled) { setDirectory([]); setDirectoryError(true) }
    }, 8000)
    getLoginDirectory(createClient())
      .then((d) => { if (!cancelled) { clearTimeout(timer); setDirectory(d); setDirectoryError(false) } })
      .catch(() => { if (!cancelled) { clearTimeout(timer); setDirectory([]); setDirectoryError(true) } })
    return () => { cancelled = true; clearTimeout(timer) }
  }, [])

  async function signIn(loginEmail: string) {
    setLoading(true)
    setError(null)
    const supabase = createClient()
    const { data, error } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password,
    })
    if (error) {
      setError(traducir(error.message))
      setLoading(false)
      return
    }
    setLoginAt() // ancla del auto-logout (el guard lo ignora para coordinadores)
    if (data.session) {
      try {
        await handOffCredentials(data.session.refresh_token)
      } catch (err) {
        // Bridge nativo falló: no bloquear el login — el sync nativo quedará
        // sin credenciales hasta el próximo TOKEN_REFRESHED (I2).
        console.error('handOffCredentials falló', err)
      }
    }
    router.push(nextPath)
    router.refresh()
  }

  const operators = directory?.filter((u) => u.role === 'operator') ?? []
  const coordinators = directory?.filter((u) => u.role === 'coordinator') ?? []
  const showCards = !manual && selected === null

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">{APP_NAME}</CardTitle>
          <p className="text-sm text-slate-500 mt-1">Trazabilidad de Desechos Clínicos</p>
        </CardHeader>
        <CardContent>
          {showCards ? (
            <div className="space-y-5">
              {directory === null ? (
                <p className="text-sm text-slate-500 text-center py-4">Cargando usuarios…</p>
              ) : directoryError ? (
                <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2.5 text-center">
                  Sin conexión con el servidor. Iniciá sesión con tu correo cuando tengas internet.
                </p>
              ) : (
                <>
                  <UserGroup title="Operadores" users={operators} onPick={setSelected} />
                  <UserGroup title="Coordinadores" users={coordinators} onPick={setSelected} />
                </>
              )}
              {directory !== null && (
                <button
                  type="button"
                  onClick={() => setManual(true)}
                  className="w-full text-center text-sm text-slate-500 hover:text-slate-700 underline"
                >
                  Ingresar con correo
                </button>
              )}
            </div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault()
                signIn(selected ? selected.email : email)
              }}
              className="space-y-4"
            >
              <button
                type="button"
                onClick={() => {
                  setSelected(null)
                  setManual(false)
                  setPassword('')
                  setError(null)
                  setShowPassword(false)
                }}
                className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
              >
                <ChevronLeft className="h-4 w-4" /> Cambiar usuario
              </button>

              {selected ? (
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold">
                    {initials(selected.name)}
                  </span>
                  <span className="font-medium">{selected.name}</span>
                </div>
              ) : (
                <div className="space-y-2">
                  <label htmlFor="email" className="text-sm font-medium">
                    Correo electrónico
                  </label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="operador@hospiwaste.com"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              )}

              <div className="space-y-2">
                <label htmlFor="password" className="text-sm font-medium">
                  Contraseña
                </label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                  {error}
                </p>
              )}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Ingresando...' : 'Ingresar'}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function UserGroup({
  title,
  users,
  onPick,
}: {
  title: string
  users: LoginDirectoryEntry[]
  onPick: (u: LoginDirectoryEntry) => void
}) {
  if (users.length === 0) return null
  return (
    <div className="space-y-2">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400">{title}</h2>
      <div className="grid grid-cols-2 gap-2">
        {users.map((u) => (
          <button
            key={u.id}
            type="button"
            onClick={() => onPick(u)}
            className="flex flex-col items-center gap-1.5 rounded-lg border border-slate-200 bg-white p-3 text-center hover:border-primary hover:bg-primary/5 active:bg-primary/10 transition-colors"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold">
              {initials(u.name)}
            </span>
            <span className="text-sm font-medium leading-tight">{u.name}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  )
}

function traducir(msg: string): string {
  if (/invalid login credentials/i.test(msg)) return 'Correo o contraseña incorrectos.'
  if (/email not confirmed/i.test(msg)) return 'Tu correo aún no está confirmado.'
  if (/fetch|network|failed to fetch|load failed|networkerror/i.test(msg))
    return 'Sin conexión. Necesitás internet para iniciar sesión.'
  return msg
}
