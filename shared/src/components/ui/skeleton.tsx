import { cn } from "@hospiwaste/shared/lib/utils"

/**
 * Bloque gris pulsante que ocupa el lugar de un dato mientras carga.
 * Siempre `aria-hidden`: no hay nada que leer todavía.
 */
function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      data-slot="skeleton"
      className={cn("animate-pulse rounded-md bg-muted/60", className)}
    />
  )
}

export { Skeleton }
