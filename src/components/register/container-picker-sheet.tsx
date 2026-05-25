'use client'

import { useEffect, useState, useMemo } from 'react'
import { Search, Check, X, Trash2, Sparkles } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { Container, Company, WasteType } from '@/lib/types'

const WASTE_LABELS: Record<WasteType, string> = {
  infectious: 'Infeccioso',
  anatomopathological: 'Anatomopatológico',
  cytotoxic: 'Citotóxico',
  liquid: 'Líquidos',
  morgue: 'Morgue',
}

export type PickerVariant = 'dirty' | 'clean'

interface Props {
  open: boolean
  variant: PickerVariant
  /** Catálogo ya filtrado (sin envases del otro lado). */
  containers: Container[]
  companies: Company[]
  /** Ids actualmente seleccionados en el form padre (estado inicial del modal). */
  selectedIds: string[]
  onClose: () => void
  onConfirm: (ids: string[]) => void
}

const VARIANT_STYLES: Record<PickerVariant, {
  title: string
  hint: string
  iconBg: string
  iconColor: string
  activeBorder: string
  activeBg: string
  activeText: string
  primaryBtn: string
  Icon: typeof Trash2
}> = {
  dirty: {
    title: 'Envases sucios recogidos',
    hint: 'Tocá un envase para agregarlo. Pasarán a pesaje en planta.',
    iconBg: 'bg-red-100',
    iconColor: 'text-red-700',
    activeBorder: 'border-red-400 ring-2 ring-red-300',
    activeBg: 'bg-red-50',
    activeText: 'text-red-900',
    primaryBtn: 'bg-red-600 hover:bg-red-700 text-white',
    Icon: Trash2,
  },
  clean: {
    title: 'Envases limpios entregados',
    hint: 'Tocá un envase para agregarlo. Son envases vacíos que se dejan al cliente.',
    iconBg: 'bg-emerald-100',
    iconColor: 'text-emerald-700',
    activeBorder: 'border-emerald-400 ring-2 ring-emerald-300',
    activeBg: 'bg-emerald-50',
    activeText: 'text-emerald-900',
    primaryBtn: 'bg-emerald-600 hover:bg-emerald-700 text-white',
    Icon: Sparkles,
  },
}

export function ContainerPickerSheet({
  open,
  variant,
  containers,
  companies,
  selectedIds,
  onClose,
  onConfirm,
}: Props) {
  const styles = VARIANT_STYLES[variant]
  const Icon = styles.Icon
  const companyMap = useMemo(
    () => Object.fromEntries(companies.map((c) => [c.id, c.name])),
    [companies],
  )

  const [search, setSearch] = useState('')
  const [local, setLocal] = useState<Set<string>>(new Set(selectedIds))

  // Resetear estado interno al (re)abrir.
  useEffect(() => {
    if (open) {
      setLocal(new Set(selectedIds))
      setSearch('')
    }
  }, [open, selectedIds])

  // Lock body scroll while open
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [open])

  if (!open) return null

  const active = containers.filter((c) => c.status === 'active')
  const q = search.trim().toLowerCase()
  const filtered = q
    ? active.filter((c) => c.id.toLowerCase().includes(q))
    : active

  // Selected first, then the rest, both sorted by id.
  const sorted = [...filtered].sort((a, b) => {
    const sa = local.has(a.id) ? 0 : 1
    const sb = local.has(b.id) ? 0 : 1
    if (sa !== sb) return sa - sb
    return a.id.localeCompare(b.id)
  })

  function toggle(id: string) {
    setLocal((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function clear() {
    setLocal(new Set())
  }

  function confirm() {
    onConfirm(Array.from(local))
    onClose()
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={styles.title}
      className="fixed inset-0 z-50 flex flex-col bg-background pointer-events-auto"
    >
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border bg-card px-4 py-3 pt-[max(env(safe-area-inset-top),0.75rem)]">
        <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-md', styles.iconBg)}>
          <Icon className={cn('h-4 w-4', styles.iconColor)} />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-semibold text-foreground truncate">{styles.title}</h2>
          <p className="text-xs text-muted-foreground">
            {local.size} seleccionado{local.size !== 1 ? 's' : ''}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Cerrar"
          onClick={onClose}
        >
          <X className="h-5 w-5" />
        </Button>
      </div>

      {/* Search */}
      <div className="border-b border-border bg-card px-4 py-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por número (ej: I-001)"
            className="h-12 pl-9 text-base"
          />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">{styles.hint}</p>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-3 py-3 pb-28 sm:px-4">
        {sorted.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-12">
            {q ? 'No se encontraron envases con ese número.' : 'No hay envases disponibles.'}
          </p>
        ) : (
          <ul className="space-y-2">
            {sorted.map((c) => {
              const isSel = local.has(c.id)
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => toggle(c.id)}
                    aria-pressed={isSel}
                    className={cn(
                      'w-full flex items-center gap-3 rounded-lg border bg-card p-4 text-left transition-all',
                      isSel
                        ? cn(styles.activeBorder, styles.activeBg)
                        : 'border-border hover:border-foreground/20 hover:bg-muted/30',
                    )}
                  >
                    <div
                      className={cn(
                        'flex h-7 w-7 shrink-0 items-center justify-center rounded-md border-2 transition-colors',
                        isSel
                          ? variant === 'dirty'
                            ? 'border-red-600 bg-red-600 text-white'
                            : 'border-emerald-600 bg-emerald-600 text-white'
                          : 'border-muted-foreground/30 bg-background',
                      )}
                    >
                      {isSel && <Check className="h-4 w-4" strokeWidth={3} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn('font-mono font-semibold text-base', isSel && styles.activeText)}>
                        {c.id}
                      </p>
                      <p className="text-sm text-muted-foreground truncate">
                        {companyMap[c.company_id] ?? '—'} · {WASTE_LABELS[c.waste_type]} · {c.size_liters} L
                      </p>
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-border bg-card px-4 py-3 pb-[max(env(safe-area-inset-bottom),0.75rem)]">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            onClick={clear}
            disabled={local.size === 0}
            className="text-muted-foreground"
          >
            Limpiar
          </Button>
          <div className="flex-1" />
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={confirm} className={styles.primaryBtn}>
            Listo ({local.size})
          </Button>
        </div>
      </div>
    </div>
  )
}
