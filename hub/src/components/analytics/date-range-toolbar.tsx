'use client'

import { ArrowRight, CalendarRange } from 'lucide-react'
import { Input } from '@hospiwaste/shared/components/ui/input'
import { cn } from '@hospiwaste/shared/lib/utils'

const DAY_FORMATTER = new Intl.DateTimeFormat('es-PA', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

const MS_PER_DAY = 86_400_000

/** 'YYYY-MM-DD' → '18 de septiembre de 2026'. Mediodía UTC para que el huso
 *  horario no corra la fecha un día hacia atrás. */
function humanDay(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`)
  return Number.isNaN(d.getTime()) ? iso : DAY_FORMATTER.format(d)
}

function daysBetween(from: string, to: string): number | null {
  const a = new Date(`${from}T12:00:00Z`).getTime()
  const b = new Date(`${to}T12:00:00Z`).getTime()
  if (Number.isNaN(a) || Number.isNaN(b)) return null
  return Math.round((b - a) / MS_PER_DAY) + 1
}

export type RangePreset = 'ytd' | '12m' | 'all'

const PRESETS: Array<{ key: RangePreset; label: string }> = [
  { key: 'ytd', label: 'Año actual' },
  { key: '12m', label: 'Últimos 12 meses' },
  { key: 'all', label: 'Todo el histórico' },
]

interface Props {
  from: string
  to: string
  onFromChange: (value: string) => void
  onToChange: (value: string) => void
  onPreset: (preset: RangePreset) => void
  /** Preset que coincide con el rango actual, o null si es un rango a mano. */
  activePreset: RangePreset | null
  /** Límites del calendario: fuera de estos días no hay datos que mostrar. */
  min: string
  max: string
  invalid: boolean
}

/**
 * Selector de rango de Analíticas.
 *
 * Los atajos van primero y como un solo control segmentado, no como tres
 * píldoras sueltas: son el camino que se usa casi siempre y leerlos juntos
 * comunica que son excluyentes entre sí. Las fechas exactas quedan al lado,
 * para el caso raro. Debajo, el rango escrito en palabras y contado en días:
 * dos campos `type="date"` dicen `2026-01-01` y `2026-09-18`, que es cierto
 * pero no se lee.
 */
export function DateRangeToolbar({
  from,
  to,
  onFromChange,
  onToChange,
  onPreset,
  activePreset,
  min,
  max,
  invalid,
}: Props) {
  const days = invalid ? null : daysBetween(from, to)

  return (
    <section className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        {/* Atajos — un solo control segmentado */}
        <div className="space-y-1.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Período
          </span>
          <div
            role="group"
            aria-label="Rangos rápidos"
            className="inline-flex rounded-lg bg-muted p-0.5 ring-1 ring-foreground/10"
          >
            {PRESETS.map(({ key, label }) => {
              const active = activePreset === key
              return (
                <button
                  key={key}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onPreset(key)}
                  className={cn(
                    'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                    active
                      ? 'bg-card text-foreground ring-1 ring-foreground/10'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Fechas exactas */}
        <div className="space-y-1.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Rango exacto
          </span>
          <div className="flex items-center gap-2">
            <Input
              id="desde"
              type="date"
              aria-label="Desde"
              aria-invalid={invalid}
              value={from}
              min={min}
              max={max}
              onChange={(e) => onFromChange(e.target.value)}
              className="h-9 w-[9.5rem] tabular-nums"
            />
            <ArrowRight aria-hidden className="size-4 shrink-0 text-muted-foreground" />
            <Input
              id="hasta"
              type="date"
              aria-label="Hasta"
              aria-invalid={invalid}
              value={to}
              min={min}
              max={max}
              onChange={(e) => onToChange(e.target.value)}
              className="h-9 w-[9.5rem] tabular-nums"
            />
          </div>
        </div>
      </div>

      {/* El rango, en palabras */}
      <p
        className={cn(
          'mt-3 flex items-center gap-1.5 border-t border-border pt-3 text-sm',
          invalid ? 'text-destructive' : 'text-muted-foreground',
        )}
      >
        <CalendarRange aria-hidden className="size-4 shrink-0" />
        {invalid ? (
          <span>La fecha inicial es posterior a la final — no hay rango que mostrar.</span>
        ) : (
          <span>
            <span className="font-medium text-foreground">{humanDay(from)}</span> al{' '}
            <span className="font-medium text-foreground">{humanDay(to)}</span>
            {days !== null && (
              <>
                {' · '}
                <span className="tabular-nums">{days}</span> días
              </>
            )}
          </span>
        )}
      </p>
    </section>
  )
}
