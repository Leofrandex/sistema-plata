'use client'

import Link from 'next/link'
import { Wrench } from 'lucide-react'
import { Card, CardContent } from '@hospiwaste/shared/components/ui/card'

export default function TreatmentLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-w-2xl mx-auto">
      <Card>
        <CardContent className="pt-6 flex flex-col items-center gap-4 text-center">
          <span className="flex size-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
            <Wrench aria-hidden className="size-7" />
          </span>
          <div>
            <h1 className="text-lg font-bold text-foreground">
              Módulo de tratamiento deshabilitado
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              El registro de tratamiento de tachos se encuentra deshabilitado temporalmente.
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
