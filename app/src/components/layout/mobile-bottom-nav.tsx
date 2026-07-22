'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Home,
  Route as RouteIcon,
  Scale,
  Flame,
  Truck,
} from 'lucide-react'
import { cn } from '@hospiwaste/shared/lib/utils'

interface TabDef {
  href: string
  label: string
  icon: typeof Home
  matchPrefix: string
}

// Operador: Inicio + sus 4 funciones. Sin dashboard ni secciones de coordinador.
const TABS: TabDef[] = [
  { href: '/',                   label: 'Inicio',      icon: Home,      matchPrefix: '/' },
  { href: '/register/route',     label: 'Recorrido',   icon: RouteIcon, matchPrefix: '/register/route' },
  { href: '/register/weighing',  label: 'Pesaje',      icon: Scale,     matchPrefix: '/register/weighing' },
  { href: '/register/treatment', label: 'Tratamiento', icon: Flame,     matchPrefix: '/register/treatment' },
  { href: '/register/transfer',  label: 'Traslado',    icon: Truck,     matchPrefix: '/register/transfer' },
]

export function MobileBottomNav() {
  const pathname = usePathname()

  if (pathname === '/login' || pathname.startsWith('/auth/')) return null

  return (
    <nav
      aria-label="Navegación principal"
      className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-sidebar border-t border-sidebar-border pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="grid grid-cols-5">
        {TABS.map(({ href, label, icon: Icon, matchPrefix }) => {
          const active =
            matchPrefix === '/'
              ? pathname === '/'
              : pathname === matchPrefix || pathname.startsWith(matchPrefix + '/')
          return (
            <li key={href}>
              <Link
                href={href}
                className={cn(
                  'flex flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium transition-colors',
                  active
                    ? 'text-white'
                    : 'text-white/60 hover:text-white',
                )}
              >
                <Icon className={cn('h-5 w-5', active && 'text-white')} />
                <span>{label}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
