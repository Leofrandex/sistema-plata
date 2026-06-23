'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useStore } from '@/lib/store'
import { isPublicPath, isOperatorAllowed } from '@/lib/auth/route-access'

/**
 * Gate de acceso en cliente (reemplaza al middleware, que no existe en export
 * estático). Sin sesión → /login?next=…; con sesión en /login → /dashboard;
 * operador en ruta de coordinador → /dashboard. La sesión la refresca
 * `supabase-js` (autoRefreshToken); aquí solo se decide la navegación.
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
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

  // Redirects según sesión y rol.
  useEffect(() => {
    if (hasSession === null) return // aún resolviendo
    const onPublic = isPublicPath(pathname)
    if (!hasSession && !onPublic) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`)
      return
    }
    if (hasSession && pathname === '/login') {
      router.replace('/dashboard')
      return
    }
    if (hasSession && !onPublic && role === 'operator' && !isOperatorAllowed(pathname)) {
      router.replace('/dashboard')
    }
  }, [hasSession, pathname, role, router])

  return <>{children}</>
}
