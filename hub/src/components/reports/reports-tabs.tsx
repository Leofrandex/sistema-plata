'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Camera, TrendingUp } from 'lucide-react'
import { cn } from '@hospiwaste/shared/lib/utils'

const TABS = [
  { href: '/reports', label: 'Registro fotográfico', icon: Camera },
  { href: '/reports/comparativo', label: 'Comparativo de kilos', icon: TrendingUp },
]

export function ReportsTabs() {
  const pathname = usePathname()

  return (
    <nav className="flex gap-1 rounded-lg bg-muted/50 p-1">
      {TABS.map(({ href, label, icon: Icon }) => {
        // `/reports` es prefijo de todo, así que la raíz se compara exacta.
        const active = href === '/reports' ? pathname === '/reports' : pathname.startsWith(href)
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
              active
                ? 'bg-card text-foreground shadow-sm ring-1 ring-foreground/10'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
