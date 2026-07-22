import Link from 'next/link'
import { Building2, Skull, History, ChevronRight } from 'lucide-react'
import { Card, CardContent } from '@hospiwaste/shared/components/ui/card'

const OPTIONS = [
  {
    href: '/register/route/anden',
    label: 'Recorrido de andén',
    description: 'Peligroso infeccioso y citotóxico. 6 horarios fijos por día.',
    icon: Building2,
    iconBg: 'bg-accent/10',
    iconText: 'text-accent',
  },
  {
    href: '/register/route/morgue',
    label: 'Recorrido de Morgue',
    description: 'Sin horario fijo. Se ejecuta cuando lo requiere la operación (aprox. cada 15 días).',
    icon: Skull,
    iconBg: 'bg-violet-100',
    iconText: 'text-violet-700',
  },
] as const

export default function RegisterRoutesPage() {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-foreground">Recorridos</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Elegí el tipo de recorrido a registrar.
        </p>
      </header>

      <div className="space-y-3">
        {OPTIONS.map(({ href, label, description, icon: Icon, iconBg, iconText }) => (
          <Link key={href} href={href} className="block">
            <Card className="hover:border-accent/40 hover:bg-accent/5 transition-colors cursor-pointer">
              <CardContent className="pt-4 flex items-center gap-4">
                <span className={`flex size-12 items-center justify-center rounded-lg ring-1 ring-foreground/5 ${iconBg} ${iconText}`}>
                  <Icon aria-hidden className="size-5" />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground">{label}</p>
                  <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
                </div>
                <ChevronRight aria-hidden className="size-5 text-muted-foreground shrink-0" />
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/70 mb-2">
          Consultar
        </p>
        <Link href="/register/route/history" className="block">
          <Card className="hover:border-accent/40 hover:bg-accent/5 transition-colors cursor-pointer">
            <CardContent className="pt-4 flex items-center gap-4">
              <span className="flex size-12 items-center justify-center rounded-lg ring-1 ring-foreground/5 bg-slate-100 text-slate-600">
                <History aria-hidden className="size-5" />
              </span>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-foreground">Historial de recorridos</p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Ver, editar o anular recorridos ya registrados.
                </p>
              </div>
              <ChevronRight aria-hidden className="size-5 text-muted-foreground shrink-0" />
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  )
}
