'use client'

import { useEffect } from 'react'
import { ChevronRight, ChevronLeft, ListChecks, Pencil, Camera } from 'lucide-react'
import { Button } from '@hospiwaste/shared/components/ui/button'
import { cn } from '@hospiwaste/shared/lib/utils'
import type { RouteEvent } from '@hospiwaste/shared/lib/types'

interface Props {
  andenes: RouteEvent[]
  selectedAndenId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelectAnden: (id: string) => void
}

/**
 * Drawer lateral con los andenes registrados durante la sesión del horario.
 * Espejo de WeighingSessionDrawer: tab flotante con contador, lista de andenes,
 * click selecciona un andén para edición.
 */
export function RouteSessionDrawer({
  andenes,
  selectedAndenId,
  open,
  onOpenChange,
  onSelectAnden,
}: Props) {
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onOpenChange(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onOpenChange])

  return (
    <>
      {!open && andenes.length > 0 && (
        <button
          type="button"
          onClick={() => onOpenChange(true)}
          aria-label={`Abrir lista de ${andenes.length} andenes`}
          className={cn(
            'fixed right-0 top-1/2 -translate-y-1/2 z-30',
            'flex items-center gap-1.5 px-2 py-3 rounded-l-lg',
            'bg-accent text-white shadow-lg ring-1 ring-foreground/10',
            'hover:bg-accent/90 transition-colors',
          )}
        >
          <ChevronLeft className="h-4 w-4" />
          <span className="flex items-center gap-1.5 text-sm font-semibold">
            <ListChecks className="h-4 w-4" />
            {andenes.length}
          </span>
        </button>
      )}

      {open && (
        <div
          className="fixed inset-0 z-40 bg-foreground/40 transition-opacity"
          onClick={() => onOpenChange(false)}
          aria-hidden
        />
      )}

      <aside
        role="dialog"
        aria-label="Andenes de la sesión de recorrido"
        aria-modal="true"
        className={cn(
          'fixed top-0 right-0 bottom-0 z-50 w-full sm:w-96 bg-card shadow-2xl',
          'ring-1 ring-foreground/10 flex flex-col',
          'transition-transform duration-200 ease-out',
          open ? 'translate-x-0' : 'translate-x-full pointer-events-none',
        )}
      >
        <header className="flex items-center justify-between px-4 py-3 border-b">
          <div>
            <h2 className="text-base font-semibold text-foreground">Andenes del recorrido</h2>
            <p className="text-xs text-muted-foreground">
              {andenes.length} andén{andenes.length !== 1 ? 'es' : ''} registrado{andenes.length !== 1 ? 's' : ''}
            </p>
          </div>
          <Button variant="ghost" size="icon" aria-label="Cerrar" onClick={() => onOpenChange(false)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </header>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {andenes.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Sin andenes todavía. Guardá el primer andén para verlo aquí.
            </p>
          ) : (
            andenes.map((a, idx) => {
              const isSelected = a.id === selectedAndenId
              const containerCount = a.containers_dirty_received.length + a.containers_clean_delivered.length
              const ubic = [a.area].filter(Boolean).join(' · ') || 'Sin ubicación'
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => onSelectAnden(a.id)}
                  className={cn(
                    'w-full text-left p-3 rounded-lg border transition-colors',
                    isSelected
                      ? 'border-accent bg-accent/5 ring-2 ring-accent/30'
                      : 'border-foreground/10 hover:border-accent/40 hover:bg-accent/5',
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground">Andén {idx + 1}</p>
                      <p className="text-xs text-muted-foreground">{ubic}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
                        <span>{containerCount} tacho{containerCount !== 1 ? 's' : ''}</span>
                        <span className="flex items-center gap-1">
                          <Camera className="h-3 w-3" /> {a.photo_ids.length}
                        </span>
                      </p>
                    </div>
                    <Pencil aria-hidden className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                  </div>
                </button>
              )
            })
          )}
        </div>
      </aside>
    </>
  )
}
