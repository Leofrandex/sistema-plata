'use client'

import { useMemo } from 'react'

function getGreeting(date: Date): string {
  const h = date.getHours()
  if (h < 12) return 'Buenos días'
  if (h < 19) return 'Buenas tardes'
  return 'Buenas noches'
}

const FORMATTER = new Intl.DateTimeFormat('es-PA', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

export function DashboardHero() {
  const { greeting, dateLabel } = useMemo(() => {
    const now = new Date()
    return {
      greeting: getGreeting(now),
      dateLabel: FORMATTER.format(now),
    }
  }, [])

  return (
    <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-primary to-accent p-6 text-primary-foreground ring-1 ring-foreground/10 sm:p-8">
      <div aria-hidden className="pointer-events-none absolute -top-16 -right-16 size-56 rounded-full bg-accent/40 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-20 left-1/3 size-48 rounded-full bg-secondary/30 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute top-4 right-6 size-24 rounded-full border border-primary-foreground/15" />
      <div aria-hidden className="pointer-events-none absolute top-10 right-12 size-12 rounded-full border border-primary-foreground/10" />

      <div className="relative flex flex-col gap-2">
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-primary-foreground/70">
          Dashboard
        </span>
        <h1 className="text-2xl font-bold sm:text-3xl">{greeting}</h1>
        <p className="text-sm text-primary-foreground/80 first-letter:uppercase">
          {dateLabel}
        </p>
      </div>
    </section>
  )
}
