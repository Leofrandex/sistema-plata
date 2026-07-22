'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@hospiwaste/shared/lib/supabase/client'
import { useStore } from '@hospiwaste/shared/lib/store'
import { signOut } from '@hospiwaste/shared/lib/auth/sign-out'
import type { UserRole } from '@hospiwaste/shared/lib/types'

interface AuthGuardProps {
  /** Decide si una ruta es pública (no requiere sesión). */
  isPublicPath: (pathname: string) => boolean
  /** A dónde va un usuario logueado que cae en /login. */
  homePath: string
  /** Si se define, solo ese rol puede usar la app; otro rol resuelto ve la
   *  pantalla de acceso denegado (no hay a dónde redirigirlo dentro de la app). */
  requiredRole?: UserRole
  children: React.ReactNode
}

/**
 * Gate de acceso en cliente (reemplaza al middleware, que no existe en export
 * estático). La política de rutas la inyecta cada app (hub exige coordinador;
 * la app de operadores acepta ambos roles). La sesión la refresca `supabase-js`
 * (autoRefreshToken); aquí solo se decide la navegación.
 */
export function AuthGuard({ isPublicPath, homePath, requiredRole, children }: AuthGuardProps) {
  const router = useRouter()
  const pathname = usePathname()
  const role = useStore((s) => s.currentRole)
  const [hasSession, setHasSession] = useState<boolean | null>(null)

  // Estado de sesión: consulta inicial + suscripción a cambios.
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(({ data }) => setHasSession(!!data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setHasSession(!!session)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  // Redirects según sesión.
  useEffect(() => {
    if (hasSession === null) return // aún resolviendo
    const onPublic = isPublicPath(pathname)
    if (!hasSession && !onPublic) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`)
      return
    }
    if (hasSession && pathname === '/login') {
      router.replace(homePath)
    }
  }, [hasSession, pathname, router, isPublicPath, homePath])

  // Rol equivocado con sesión activa (p. ej. operador en el hub): pantalla de
  // acceso denegado. Con rol aún sin resolver (null) se renderiza normal para
  // no bloquear el arranque offline.
  if (
    requiredRole &&
    hasSession &&
    role !== null &&
    role !== requiredRole &&
    !isPublicPath(pathname)
  ) {
    return <AccessDenied requiredRole={requiredRole} />
  }

  return <>{children}</>
}

function AccessDenied({ requiredRole }: { requiredRole: UserRole }) {
  const router = useRouter()
  async function handleSignOut() {
    await signOut()
    router.replace('/login')
  }
  const label = requiredRole === 'coordinator' ? 'coordinadores' : 'operadores'
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-6 text-center">
      <h1 className="text-xl font-bold text-foreground">Acceso restringido</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        Esta aplicación es solo para {label}. Tu cuenta no tiene acceso con el
        rol actual.
      </p>
      <button
        type="button"
        onClick={handleSignOut}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
      >
        Cerrar sesión
      </button>
    </div>
  )
}
