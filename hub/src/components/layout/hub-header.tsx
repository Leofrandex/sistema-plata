'use client'

import { usePathname, useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { APP_NAME } from '@hospiwaste/shared/lib/constants'
import { signOut } from '@hospiwaste/shared/lib/auth/sign-out'

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/containers': 'Tachos',
  '/equipment': 'Equipos',
  '/history': 'Historial',
  '/reports': 'Reportes',
  '/admin/containers': 'Administrar Tachos',
  '/admin/clients': 'Administrar Clientes',
  '/admin/companies': 'Administrar Empresas',
}

/** Header móvil del hub (en desktop la sidebar cubre navegación y salida). */
export function HubHeader() {
  const pathname = usePathname()
  const router = useRouter()
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
      <button
        type="button"
        aria-label="Cerrar sesión"
        className="flex items-center gap-1.5 py-1.5 pl-2.5 pr-3 -mr-1 rounded-md border border-sidebar-border/60 bg-white/5 text-sm font-medium text-sidebar-foreground hover:bg-white/15 active:bg-white/20 transition-colors"
        onClick={handleSignOut}
      >
        <LogOut className="h-4 w-4" />
        Salir
      </button>
    </header>
  )
}
