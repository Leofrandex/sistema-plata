'use client'

import { useEffect } from 'react'
import { ChevronRight, ChevronLeft, ListChecks, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { computeNetWeight } from '@/lib/data/containers'
import type { Container, ContainerReception } from '@/lib/types'

interface Props {
  receptions: ContainerReception[]
  containers: Container[]
  selectedReceptionId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelectReception: (id: string) => void
}

/**
 * Drawer lateral con el listado de envases pesados durante la sesión.
 * - Tab flotante en el borde derecho (con contador) abre y cierra.
 * - Al click en un envase, lo selecciona para edición (la página padre carga
 *   ese reception al WeighingForm en modo 'edit').
 * - Mientras está cerrado, solo se ve el tab vertical con el contador.
 */
export function WeighingSessionDrawer({
  receptions,
  containers,
  selectedReceptionId,
  open,
  onOpenChange,
  onSelectReception,
}: Props) {
  const containerMap = Object.fromEntries(containers.map((c) => [c.id, c]))

  // Cerrar con Escape
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
      {/* Tab flotante en el borde derecho — visible siempre que haya registros */}
      {!open && receptions.length > 0 && (
        <button
          type="button"
          onClick={() => onOpenChange(true)}
          aria-label={`Abrir lista de ${receptions.length} registros`}
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
            {receptions.length}
          </span>
        </button>
      )}

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-foreground/40 transition-opacity"
          onClick={() => onOpenChange(false)}
          aria-hidden
        />
      )}

      {/* Drawer */}
      <aside
        role="dialog"
        aria-label="Registros de la sesión de pesaje"
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
            <h2 className="text-base font-semibold text-foreground">
              Registros de la sesión
            </h2>
            <p className="text-xs text-muted-foreground">
              {receptions.length} envase{receptions.length !== 1 ? 's' : ''} pesado{receptions.length !== 1 ? 's' : ''}
            </p>
          </div>
          <Button variant="ghost" size="icon" aria-label="Cerrar" onClick={() => onOpenChange(false)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </header>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {receptions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Sin registros todavía. Pesá el primer envase para verlo aquí.
            </p>
          ) : (
            receptions.map((r) => {
              const container = containerMap[r.container_id]
              const tare = container?.tare_weight_kg ?? 0
              const net = computeNetWeight(r.gross_weight_kg, tare)
              const isSelected = r.id === selectedReceptionId
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => onSelectReception(r.id)}
                  className={cn(
                    'w-full text-left p-3 rounded-lg border transition-colors',
                    isSelected
                      ? 'border-accent bg-accent/5 ring-2 ring-accent/30'
                      : 'border-foreground/10 hover:border-accent/40 hover:bg-accent/5',
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-mono font-semibold text-foreground">{r.container_id}</p>
                      <p className="text-xs text-muted-foreground">
                        Bruto {r.gross_weight_kg} kg · Neto <strong className="text-foreground">{net} kg</strong>
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {new Date(r.arrived_at).toLocaleTimeString('es-PA', { hour: '2-digit', minute: '2-digit' })}
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
