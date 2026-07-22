'use client'

import { usePathname, useRouter } from 'next/navigation'
import { LogOut, Clock } from 'lucide-react'
import { APP_NAME } from '@hospiwaste/shared/lib/constants'
import { useOperatorCountdown } from '@/hooks/use-operator-countdown'
import { formatRemaining } from '@hospiwaste/shared/lib/session-timeout'
import { cn } from '@hospiwaste/shared/lib/utils'
import { signOut } from '@hospiwaste/shared/lib/auth/sign-out'

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/containers': 'Tachos',
  '/reports': 'Reportes',
  '/register/route': 'Recorridos',
  '/register/route/anden': 'Recorridos de andén',
  '/register/route/morgue': 'Recorrido de Morgue',
  '/register/weighing': 'Pesaje',
  '/register/treatment': 'Registrar Tratamiento',
  '/register/transfer': 'Registrar Traslado',
  '/admin/containers': 'Administrar Tachos',
  '/admin/clients': 'Administrar Clientes',
  '/admin/companies': 'Administrar Empresas',
}

export function MobileHeader() {
  const pathname = usePathname()
  const router = useRouter()
  const { active, isWarning, remainingMs } = useOperatorCountdown()
  async function handleSignOut() {
    await signOut()
    router.replace('/login')
  }
  if (pathname === '/login' || pathname.startsWith('/auth/')) return null
  const title =
    PAGE_TITLES[pathname] ??
    Object.entries(PAGE_TITLES)
      .filter(([prefix]) => prefix !== '/' && pathname.startsWith(prefix))
      .sort((a, b) => b[0].length - a[0].length)[0]?.[1] ??
    APP_NAME

  return (
    <header className="md:hidden flex items-center justify-between h-14 border-b bg-sidebar border-sidebar-border px-4 sticky top-0 z-10">
      <span className="font-semibold text-sidebar-foreground">{title}</span>
      <div className="flex items-center gap-2">
        {active && (
          <span
            className={cn(
              'flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold tabular-nums',
              isWarning
                ? 'bg-amber-100 text-amber-900'
                : 'bg-white/10 text-sidebar-foreground'
            )}
            aria-label="Tiempo restante de sesión"
          >
            <Clock className="h-3.5 w-3.5" />
            {formatRemaining(remainingMs)}
          </span>
        )}
        <button
          type="button"
          aria-label="Cerrar sesión"
          className="flex items-center gap-1.5 py-1.5 pl-2.5 pr-3 -mr-1 rounded-md border border-sidebar-border/60 bg-white/5 text-sm font-medium text-sidebar-foreground hover:bg-white/15 active:bg-white/20 transition-colors"
          onClick={handleSignOut}
        >
          <LogOut className="h-4 w-4" />
          Salir
        </button>
      </div>
    </header>
  )
}
