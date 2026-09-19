import { Skeleton } from '@hospiwaste/shared/components/ui/skeleton'
import { cn } from '@hospiwaste/shared/lib/utils'

interface Props {
  /** Alto del bloque del cuerpo, en clases de Tailwind (ej. `h-56`). */
  bodyHeight?: string
  /** Si se pasa, el cuerpo son N barras apiladas en vez de un bloque: para las
   *  secciones que muestran una lista y no un gráfico. */
  rows?: number
  className?: string
}

/**
 * Tarjeta del dashboard mientras la hidratación del store está en vuelo.
 *
 * Replica el mismo `<section>` que las secciones reales — mismo alto, mismo
 * radio, mismo ring — para que al llegar los datos la tarjeta se rellene en su
 * sitio y no empuje al resto de la página.
 */
export function CardSkeleton({ bodyHeight = 'h-56', rows, className }: Props) {
  return (
    <section className={cn('rounded-2xl bg-card p-5 ring-1 ring-foreground/10', className)}>
      <header className="mb-4 flex items-center gap-2.5">
        <Skeleton className="h-9 w-9 shrink-0 rounded-lg" />
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-3.5 w-40" />
          <Skeleton className="h-3 w-28" />
        </div>
      </header>

      {rows === undefined ? (
        <Skeleton className={cn('w-full flex-1 rounded-lg', bodyHeight)} />
      ) : (
        <div className="flex-1 space-y-2.5">
          {Array.from({ length: rows }, (_, i) => (
            <Skeleton key={i} className="h-9 w-full rounded-lg" />
          ))}
        </div>
      )}
    </section>
  )
}
