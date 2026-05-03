'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Package, Settings, ChevronDown, ClipboardList } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useState } from 'react'

const REGISTER_LINKS = [
  { href: '/register/exchange', label: 'Intercambio' },
  { href: '/register/weighing', label: 'Pesaje' },
  { href: '/register/storage', label: 'Cámara fría' },
  { href: '/register/treatment', label: 'Tratamiento' },
  { href: '/register/transfer', label: 'Traslado externo' },
  { href: '/register/location', label: 'Ubicación' },
]

const ADMIN_LINKS = [
  { href: '/admin/containers', label: 'Envases' },
  { href: '/admin/clients', label: 'Clientes' },
]

const TOP_NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/containers', label: 'Envases', icon: Package },
]

export function Sidebar() {
  const pathname = usePathname()
  const [registerOpen, setRegisterOpen] = useState(pathname.startsWith('/register'))
  const [adminOpen, setAdminOpen] = useState(pathname.startsWith('/admin'))

  return (
    <aside className="hidden md:flex w-56 flex-col border-r border-sidebar-border bg-sidebar h-screen sticky top-0">
      <div className="p-4 border-b border-sidebar-border">
        <span className="font-bold text-lg text-sidebar-foreground">Hospimed</span>
      </div>
      <nav className="flex-1 p-3 space-y-1">
        {TOP_NAV.map(({ href, label, icon: Icon }) => (
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
              {REGISTER_LINKS.map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    'block px-3 py-1.5 rounded-md text-sm transition-colors',
                    pathname === href
                      ? 'text-white font-semibold border-l-2 border-sidebar-primary pl-2'
                      : 'text-white/55 hover:text-white hover:bg-white/10'
                  )}
                >
                  {label}
                </Link>
              ))}
            </div>
          )}
        </div>

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
                      ? 'text-white font-semibold border-l-2 border-sidebar-primary pl-2'
                      : 'text-white/55 hover:text-white hover:bg-white/10'
                  )}
                >
                  {label}
                </Link>
              ))}
            </div>
          )}
        </div>
      </nav>
    </aside>
  )
}
