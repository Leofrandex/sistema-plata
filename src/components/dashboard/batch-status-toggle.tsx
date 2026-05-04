'use client'

import { cn } from '@/lib/utils'

export type BatchStatusValue = 'active' | 'completed'

interface Props {
  value: BatchStatusValue
  onChange: (value: BatchStatusValue) => void
  activeCount: number
  completedCount: number
}

export function BatchStatusToggle({ value, onChange, activeCount, completedCount }: Props) {
  const options: { value: BatchStatusValue; label: string; count: number; dotClass: string }[] = [
    { value: 'active', label: 'Lotes activos', count: activeCount, dotClass: 'bg-accent' },
    { value: 'completed', label: 'Lotes completados', count: completedCount, dotClass: 'bg-emerald-500' },
  ]

  return (
    <div
      role="radiogroup"
      aria-label="Estado de lotes"
      className="inline-flex w-full items-center gap-1 rounded-xl bg-muted p-1 ring-1 ring-foreground/10 sm:w-auto"
    >
      {options.map((opt) => {
        const selected = value === opt.value
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(opt.value)}
            className={cn(
              'group relative flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all sm:flex-initial focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background',
              selected
                ? 'bg-card text-foreground shadow-sm ring-1 ring-foreground/10'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <span className={cn('size-2 rounded-full transition-opacity', opt.dotClass, selected ? 'opacity-100' : 'opacity-50')} />
            <span>{opt.label}</span>
            <span
              className={cn(
                'inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-semibold tabular-nums',
                selected ? 'bg-accent text-accent-foreground' : 'bg-foreground/10 text-foreground/70'
              )}
            >
              {opt.count}
            </span>
          </button>
        )
      })}
    </div>
  )
}
