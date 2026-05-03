'use client'

import { usePathname } from 'next/navigation'

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/containers': 'Envases',
  '/register/exchange': 'Registrar Intercambio',
  '/register/weighing': 'Registrar Pesaje',
  '/register/storage': 'Registrar Cámara Fría',
  '/register/treatment': 'Registrar Tratamiento',
  '/register/transfer': 'Registrar Traslado',
  '/register/location': 'Reportar Ubicación',
  '/admin/containers': 'Administrar Envases',
  '/admin/clients': 'Administrar Clientes',
}

export function MobileHeader() {
  const pathname = usePathname()
  const title = PAGE_TITLES[pathname] ?? 'Hospimed'

  return (
    <header className="md:hidden flex items-center h-14 border-b bg-sidebar border-sidebar-border px-4 sticky top-0 z-10">
      <span className="font-semibold text-sidebar-foreground">{title}</span>
    </header>
  )
}
