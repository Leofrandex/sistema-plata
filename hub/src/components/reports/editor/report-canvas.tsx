'use client'

import { useState } from 'react'
import { useDraggable, useDroppable } from '@dnd-kit/core'
import { SortableContext, rectSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Plus, Trash2, X } from 'lucide-react'
import type { Photo } from '@hospiwaste/shared/lib/types'
import { cn } from '@hospiwaste/shared/lib/utils'
import {
  addCuadro, clearSlot, paginateDay, removeCuadro, setComment,
  type DragRef, type LayoutCuadro, type ReportLayout,
} from '@/lib/data/report-layout'

interface Props {
  layout: ReportLayout
  companyName: string
  onChange: (next: ReportLayout) => void
}

/** Hojas A4 imitadas en HTML: es la vista editable, no el PDF. */
export function ReportCanvas({ layout, companyName, onChange }: Props) {
  return (
    <div className="mx-auto max-w-5xl space-y-10">
      {layout.days.map((day) => (
        <section key={day.date} className="space-y-4">
          <h2 className="text-sm font-semibold text-muted-foreground">{day.date}</h2>
          {/* Un contexto por día: los cuadros se reordenan solo dentro de su día. */}
          <SortableContext items={day.cuadros.map((c) => c.id)} strategy={rectSortingStrategy}>
            {paginateDay(day).map((page, i) => (
              <Sheet key={i} companyName={companyName} date={day.date}>
                {page.map((c) => (
                  <EditableCuadro key={c.id} cuadro={c} date={day.date} layout={layout} onChange={onChange} />
                ))}
              </Sheet>
            ))}
          </SortableContext>
          <button
            type="button"
            onClick={() => onChange(addCuadro(layout, day.date))}
            className="mx-auto flex items-center gap-1.5 rounded-lg border border-dashed border-slate-400 px-4 py-2 text-sm text-slate-600 hover:border-slate-600 hover:text-slate-900"
          >
            <Plus className="h-4 w-4" />
            Agregar cuadro a este día
          </button>
        </section>
      ))}
    </div>
  )
}

function Sheet({ companyName, date, children }: { companyName: string; date: string; children: React.ReactNode }) {
  const meta: [string, string][] = [['Edificio', '4E'], ['Ubicación', 'PTDP'], ['Empresa', companyName], ['Fecha', date]]
  return (
    <div className="rounded-sm bg-white p-5 shadow-md ring-1 ring-black/5">
      <div className="mb-2 flex items-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-riga.png" alt="RIGA" className="h-8 w-24 object-contain object-left" />
        <p className="flex-1 text-center text-sm font-bold tracking-widest text-slate-900">REGISTRO FOTOGRÁFICO</p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-cpch.jpg" alt="CPCH" className="h-9 w-24 object-contain object-right" />
      </div>
      <div className="mb-3 flex border border-slate-400 text-[11px]">
        {meta.map(([k, v]) => (
          <div key={k} className="flex border-r border-slate-400 last:border-r-0">
            <span className="bg-slate-200 px-2 py-1 font-semibold text-slate-700">{k}</span>
            <span className="min-w-16 px-2 py-1 text-slate-900">{v}</span>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">{children}</div>
    </div>
  )
}

function EditableCuadro({ cuadro, date, layout, onChange }: { cuadro: LayoutCuadro; date: string; layout: ReportLayout; onChange: (next: ReportLayout) => void }) {
  const data: DragRef = { type: 'cuadro', cuadroId: cuadro.id, date }
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: cuadro.id, data })
  const [confirming, setConfirming] = useState(false)

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn('rounded-sm border border-slate-400 bg-white', isDragging && 'relative z-10 opacity-80 shadow-xl')}
    >
      <div className="flex items-center gap-1 border-b border-slate-400 bg-slate-100 px-1 py-0.5">
        <button
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          type="button"
          aria-label="Mover cuadro"
          className="cursor-grab touch-none text-slate-500 hover:text-slate-900 active:cursor-grabbing"
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <span className="flex-1 truncate text-center text-[11px] font-semibold text-slate-700">{cuadro.label}</span>
        {confirming ? (
          <span className="flex items-center gap-1.5 text-[11px]">
            ¿Eliminar?
            <button type="button" className="font-semibold text-red-700" onClick={() => onChange(removeCuadro(layout, cuadro.id))}>Sí</button>
            <button type="button" className="text-slate-600" onClick={() => setConfirming(false)}>No</button>
          </span>
        ) : (
          <button type="button" aria-label="Eliminar cuadro" onClick={() => setConfirming(true)} className="text-slate-400 hover:text-red-700">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <div className="grid grid-cols-4 gap-0.5 p-0.5">
        {cuadro.slots.map((photo, i) => (
          <SlotBox
            key={i}
            cuadroId={cuadro.id}
            slot={i}
            photo={photo}
            onClear={() => onChange(clearSlot(layout, { cuadroId: cuadro.id, slot: i }))}
          />
        ))}
      </div>
      <label className="flex items-center gap-1 border-t border-slate-400 px-1.5 py-1 text-[11px]">
        <span className="font-semibold text-slate-700">Comentario:</span>
        <input
          value={cuadro.comment}
          onChange={(e) => onChange(setComment(layout, cuadro.id, e.target.value))}
          className="flex-1 rounded bg-transparent px-0.5 text-slate-900 outline-none hover:bg-slate-50 focus:bg-amber-50"
        />
      </label>
    </div>
  )
}

function SlotBox({ cuadroId, slot, photo, onClear }: { cuadroId: string; slot: number; photo: Photo | null; onClear: () => void }) {
  const id = `slot:${cuadroId}:${slot}`
  const data: DragRef = { type: 'slot', cuadroId, slot }
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id, data })
  const { setNodeRef: setDragRef, attributes, listeners, isDragging } = useDraggable({ id, data, disabled: !photo })

  return (
    <div
      ref={setDropRef}
      className={cn('group relative aspect-[95/96] bg-slate-50', isOver && 'ring-2 ring-inset ring-sky-500')}
    >
      {photo && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={setDragRef}
            {...attributes}
            {...listeners}
            src={photo.url}
            alt=""
            loading="lazy"
            draggable={false}
            className={cn('h-full w-full cursor-grab touch-none object-contain', isDragging && 'opacity-30')}
          />
          <button
            type="button"
            aria-label="Vaciar recuadro"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={onClear}
            className="absolute right-0.5 top-0.5 hidden rounded bg-black/60 p-0.5 text-white group-hover:block"
          >
            <X className="h-3 w-3" />
          </button>
        </>
      )}
    </div>
  )
}
