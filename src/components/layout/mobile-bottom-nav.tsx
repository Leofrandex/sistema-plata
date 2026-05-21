'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Route as RouteIcon,
  Scale,
  FileText,
  MoreHorizontal,
  Package,
  Flame,
  Truck,
  MapPin,
  Settings,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface TabDef {
  href: string
  label: string
  icon: typeof LayoutDashboard
  matchPrefix: string
}

const PRIMARY_TABS: TabDef[] = [
  { href: '/dashboard',         label: 'Inicio',    icon: LayoutDashboard, matchPrefix: '/dashboard' },
  { href: '/register/route',    label: 'Recorrido', icon: RouteIcon,       matchPrefix: '/register/route' },
  { href: '/register/weighing', label: 'Pesaje',    icon: Scale,           matchPrefix: '/register/weighing' },
  { href: '/reports',           label: 'Reportes',  icon: FileText,        matchPrefix: '/reports' },
]

interface MoreLink {
  href: string
  label: string
  icon: typeof LayoutDashboard
}

const MORE_LINKS: MoreLink[] = [
  { href: '/containers',          label: 'Envases',          icon: Package },
  { href: '/register/treatment',  label: 'Tratamiento',      icon: Flame },
  { href: '/register/transfer',   label: 'Traslado externo', icon: Truck },
  { href: '/register/location',   label: 'Ubicación',        icon: MapPin },
  { href: '/admin/containers',    label: 'Admin envases',    icon: Settings },
  { href: '/admin/clients',       label: 'Admin clientes',   icon: Settings },
  { href: '/admin/companies',     label: 'Admin empresas',   icon: Settings },
]

export function MobileBottomNav() {
  const pathname = usePathname()
  const [moreOpen, setMoreOpen] = useState(false)

  const isMoreActive = MORE_LINKS.some((l) => pathname.startsWith(l.href))

  return (
    <>
      <nav
        aria-label="Navegación principal"
        className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-sidebar border-t border-sidebar-border pb-[env(safe-area-inset-bottom)]"
      >
        <ul className="grid grid-cols-5">
          {PRIMARY_TABS.map(({ href, label, icon: Icon, matchPrefix }) => {
            const active = pathname === matchPrefix || pathname.startsWith(matchPrefix + '/')
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
          <li>
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              aria-haspopup="dialog"
              aria-expanded={moreOpen}
              className={cn(
                'w-full flex flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium transition-colors',
                isMoreActive ? 'text-white' : 'text-white/60 hover:text-white',
              )}
            >
              <MoreHorizontal className="h-5 w-5" />
              <span>Más</span>
            </button>
          </li>
        </ul>
      </nav>

      {moreOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Más opciones"
          className="md:hidden fixed inset-0 z-40 flex items-end bg-foreground/50"
          onClick={() => setMoreOpen(false)}
        >
          <div
            className="w-full bg-card rounded-t-2xl shadow-2xl ring-1 ring-foreground/10 p-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] animate-in slide-in-from-bottom duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-3 pt-2 pb-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Más opciones
              </span>
              <button
                type="button"
                onClick={() => setMoreOpen(false)}
                aria-label="Cerrar"
                className="p-1 rounded-md text-muted-foreground hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <ul className="grid grid-cols-1 gap-0.5 py-1">
              {MORE_LINKS.map(({ href, label, icon: Icon }) => {
                const active = pathname === href || pathname.startsWith(href + '/')
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      onClick={() => setMoreOpen(false)}
                      className={cn(
                        'flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors',
                        active
                          ? 'bg-accent/10 text-accent font-medium'
                          : 'text-foreground hover:bg-muted',
                      )}
                    >
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      {label}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        </div>
      )}
    </>
  )
}
