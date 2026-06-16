'use client'

import { usePathname } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { APP_NAME } from '@/lib/constants'

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
  if (pathname === '/login' || pathname.startsWith('/auth/')) return null
  // matchear prefijo para rutas dinámicas (ej: /register/route/06:30)
  const title =
    PAGE_TITLES[pathname] ??
    Object.entries(PAGE_TITLES)
      .filter(([prefix]) => prefix !== '/' && pathname.startsWith(prefix))
      .sort((a, b) => b[0].length - a[0].length)[0]?.[1] ??
    APP_NAME

  return (
    <header className="md:hidden flex items-center justify-between h-14 border-b bg-sidebar border-sidebar-border px-4 sticky top-0 z-10">
      <span className="font-semibold text-sidebar-foreground">{title}</span>
      <form action="/auth/signout" method="post">
        <button
          type="submit"
          aria-label="Cerrar sesión"
          className="flex items-center gap-1.5 py-1.5 pl-2.5 pr-3 -mr-1 rounded-md border border-sidebar-border/60 bg-white/5 text-sm font-medium text-sidebar-foreground hover:bg-white/15 active:bg-white/20 transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Salir
        </button>
      </form>
    </header>
  )
}
