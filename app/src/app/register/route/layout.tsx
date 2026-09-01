'use client'

import Link from 'next/link'
import { Wrench } from 'lucide-react'
import { INTERIM_MODE } from '@hospiwaste/shared/lib/config/interim-mode'
import { Card, CardContent } from '@hospiwaste/shared/components/ui/card'

export default function RouteLayout({ children }: { children: React.ReactNode }) {
  if (!INTERIM_MODE) return <>{children}</>

  return (
    <div className="max-w-2xl mx-auto">
      <Card>
        <CardContent className="pt-6 flex flex-col items-center gap-4 text-center">
          <span className="flex size-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
            <Wrench aria-hidden className="size-7" />
          </span>
          <div>
            <h1 className="text-lg font-bold text-foreground">
              Registro de recorridos en mantenimiento
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Estamos rehaciendo cómo se guardan y se suben los recorridos para que funcionen
              sin señal. Mientras tanto, registrá los recorridos en papel y usá la app para el
              pesaje.
            </p>
          </div>
          <Link
            href="/"
            className="inline-flex items-center rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:border-accent/40"
          >
            Volver al inicio
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}
