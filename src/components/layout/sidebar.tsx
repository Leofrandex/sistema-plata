'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Package, Settings, ChevronDown, ClipboardList, FileText, LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'
import { APP_NAME } from '@/lib/constants'
import { useStore } from '@/lib/store'
import { useState } from 'react'

const REGISTER_LINKS = [
  { href: '/register/route', label: 'Recorrido' },
  { href: '/register/weighing', label: 'Pesaje' },
  { href: '/register/treatment', label: 'Tratamiento' },
  { href: '/register/transfer', label: 'Traslado externo' },
]

const ADMIN_LINKS = [
  { href: '/admin/containers', label: 'Tachos' },
  { href: '/admin/clients', label: 'Clientes' },
  { href: '/admin/companies', label: 'Empresas' },
]

const TOP_NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/containers', label: 'Tachos', icon: Package },
  { href: '/reports', label: 'Reportes', icon: FileText },
]

export function Sidebar() {
  const pathname = usePathname()
  const role = useStore((s) => s.currentRole)
  const [registerOpen, setRegisterOpen] = useState(pathname.startsWith('/register'))
  const [adminOpen, setAdminOpen] = useState(pathname.startsWith('/admin'))

  // No mostrar shell en rutas de auth
  if (pathname === '/login' || pathname.startsWith('/auth/')) return null

  // Solo el coordinador ve todo. Operador (o rol aún sin cargar) ve únicamente
  // Inicio, Recorrido, Pesaje y Tratamiento.
  const isCoordinator = role === 'coordinator'
  const topNav = isCoordinator ? TOP_NAV : TOP_NAV.filter((n) => n.href === '/dashboard')
  const registerLinks = isCoordinator
    ? REGISTER_LINKS
    : REGISTER_LINKS.filter((l) => l.href !== '/register/transfer')

  return (
    <aside className="hidden md:flex w-56 flex-col border-r border-sidebar-border bg-sidebar h-screen sticky top-0">
      <div className="p-4 border-b border-sidebar-border">
        <span className="font-bold text-lg text-sidebar-foreground">{APP_NAME}</span>
      </div>
      <nav className="flex-1 p-3 space-y-1 flex flex-col">
        {topNav.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
              pathname.startsWith(href)
                ? 'bg-sidebar-primary text-white'
                : 'text-white/70 hover:bg-white/10 hover:text-white'
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        ))}

        <div>
          <button
            onClick={() => setRegisterOpen((o) => !o)}
            className={cn(
              'w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
              pathname.startsWith('/register')
                ? 'bg-sidebar-primary text-white'
                : 'text-white/70 hover:bg-white/10 hover:text-white'
            )}
          >
            <ClipboardList className="h-4 w-4" />
            <span className="flex-1 text-left">Registrar</span>
            <ChevronDown className={cn('h-3 w-3 transition-transform', registerOpen && 'rotate-180')} />
          </button>
          {registerOpen && (
            <div className="ml-7 mt-1 space-y-0.5">
              {registerLinks.map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    'block px-3 py-1.5 rounded-md text-sm transition-colors',
                    pathname === href
                      ? 'bg-sidebar-primary text-white font-medium'
                      : 'text-white/55 hover:bg-white/10 hover:text-white'
                  )}
                >
                  {label}
                </Link>
              ))}
            </div>
          )}
        </div>

        {isCoordinator && (
        <div>
          <button
            onClick={() => setAdminOpen((o) => !o)}
            className={cn(
              'w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
              pathname.startsWith('/admin')
                ? 'bg-sidebar-primary text-white'
                : 'text-white/70 hover:bg-white/10 hover:text-white'
            )}
          >
            <Settings className="h-4 w-4" />
            <span className="flex-1 text-left">Admin</span>
            <ChevronDown className={cn('h-3 w-3 transition-transform', adminOpen && 'rotate-180')} />
          </button>
          {adminOpen && (
            <div className="ml-7 mt-1 space-y-0.5">
              {ADMIN_LINKS.map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    'block px-3 py-1.5 rounded-md text-sm transition-colors',
                    pathname === href
                      ? 'bg-sidebar-primary text-white font-medium'
                      : 'text-white/55 hover:bg-white/10 hover:text-white'
                  )}
                >
                  {label}
                </Link>
              ))}
            </div>
          )}
        </div>
        )}

        <div className="mt-auto pt-4 border-t border-white/10">
          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm text-white/70 hover:bg-white/10 hover:text-white transition-colors"
            >
              <LogOut className="h-4 w-4" />
              <span>Cerrar sesión</span>
            </button>
          </form>
        </div>
      </nav>
    </aside>
  )
}
