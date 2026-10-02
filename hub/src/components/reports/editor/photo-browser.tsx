'use client'

import { useState } from 'react'
import { useDraggable } from '@dnd-kit/core'
import { Check, ChevronDown, ChevronRight, ImageOff } from 'lucide-react'
import type { Photo } from '@hospiwaste/shared/lib/types'
import { cn } from '@hospiwaste/shared/lib/utils'
import type { BrowserDay } from '@/lib/data/photo-browser-tree'
import type { DragRef } from '@/lib/data/report-layout'

interface Props {
  tree: BrowserDay[]
  /** Ids de fotos que ya están en algún recuadro del canvas. */
  used: Set<string>
}

/** Panel izquierdo: carpetas día → sesión → tacho, con miniaturas arrastrables. */
export function PhotoBrowser({ tree, used }: Props) {
  // Todo cerrado al inicio: las miniaturas se piden recién al abrir la carpeta.
  const [open, setOpen] = useState<Set<string>>(new Set())
  const toggle = (key: string) =>
    setOpen((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  if (tree.length === 0) {
    return <p className="text-sm text-muted-foreground">No hay pesajes con fotos en este rango.</p>
  }

  return (
    <div className="space-y-0.5 text-sm">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Fotos de pesaje</p>
      {tree.map((day) => (
        <Folder key={day.date} label={day.date} open={open.has(day.date)} onToggle={() => toggle(day.date)}>
          {day.sessions.map((s) => (
            <Folder key={s.key} label={s.label} open={open.has(s.key)} onToggle={() => toggle(s.key)}>
              {s.items.map((item) => (
                <Folder key={item.key} label={item.label} open={open.has(item.key)} onToggle={() => toggle(item.key)}>
                  <div className="flex gap-2 py-1">
                    <Thumb photo={item.scale} caption="Balanza" used={used} />
                    <Thumb photo={item.tacho} caption="Tacho" used={used} />
                  </div>
                </Folder>
              ))}
            </Folder>
          ))}
        </Folder>
      ))}
    </div>
  )
}

function Folder({ label, open, onToggle, children }: { label: string; open: boolean; onToggle: () => void; children: React.ReactNode }) {
  const Icon = open ? ChevronDown : ChevronRight
  return (
    <div>
      <button type="button" onClick={onToggle} className="flex w-full items-center gap-1 rounded px-1 py-0.5 text-left hover:bg-muted">
        <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <span className="truncate">{label}</span>
      </button>
      {open && <div className="ml-2 border-l pl-2">{children}</div>}
    </div>
  )
}

function Thumb({ photo, caption, used }: { photo: Photo | null; caption: string; used: Set<string> }) {
  if (!photo) {
    return (
      <div className="w-16 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded bg-muted text-[10px] text-muted-foreground">Sin foto</div>
        <p className="mt-0.5 text-[11px] font-medium">{caption}</p>
      </div>
    )
  }
  return <DraggableThumb photo={photo} caption={caption} inUse={used.has(photo.id)} />
}

function DraggableThumb({ photo, caption, inUse }: { photo: Photo; caption: string; inUse: boolean }) {
  const data: DragRef = { type: 'browser', photo }
  const { setNodeRef, attributes, listeners, isDragging } = useDraggable({ id: `browser:${photo.id}`, data })
  const [broken, setBroken] = useState(false)
  return (
    <div className="w-16 text-center">
      <div
        ref={setNodeRef}
        {...attributes}
        {...listeners}
        className={cn(
          'flex h-16 w-16 cursor-grab touch-none items-center justify-center overflow-hidden rounded bg-muted ring-1 ring-border',
          isDragging && 'opacity-40',
        )}
      >
        {broken ? (
          <ImageOff className="h-5 w-5 text-muted-foreground" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo.url} alt={caption} loading="lazy" draggable={false} onError={() => setBroken(true)} className="h-full w-full object-contain" />
        )}
      </div>
      <p className="mt-0.5 text-[11px] font-medium">{caption}</p>
      {inUse && (
        <p className="flex items-center justify-center gap-0.5 text-[10px] text-emerald-700">
          <Check className="h-3 w-3" />
          en uso
        </p>
      )}
    </div>
  )
}
