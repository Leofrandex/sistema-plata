import type { Photo } from '@hospiwaste/shared/lib/types'
import { chunk, type PhotographicReportData } from './reports'

/**
 * La "maqueta" del registro fotográfico: lo que el PDF dibuja. El reporte
 * automático la arma con `buildReportLayout`; el editor la modifica con las
 * acciones de abajo. Las dos descargas usan el mismo componente PDF.
 */

/** Recuadros por cuadro: grilla de 4 columnas × 2 filas. */
export const SLOTS_PER_CUADRO = 8
/** Columnas de la grilla; en pesaje, una por par (balanza arriba, tacho abajo). */
export const COLUMNS = 4
export const CUADROS_PER_PAGE = 4

export interface LayoutCuadro {
  id: string
  label: string
  comment: string
  /** SLOTS_PER_CUADRO posiciones: [0..3] fila de arriba, [4..7] fila de abajo. */
  slots: (Photo | null)[]
}

export interface LayoutDay {
  date: string
  cuadros: LayoutCuadro[]
}

export interface ReportLayout {
  days: LayoutDay[]
}

const emptySlots = (): (Photo | null)[] => Array<Photo | null>(SLOTS_PER_CUADRO).fill(null)

export function buildReportLayout(data: PhotographicReportData): ReportLayout {
  return {
    days: data.days.map((day) => {
      const cuadros: LayoutCuadro[] = []
      const push = (label: string, slots: (Photo | null)[]) =>
        cuadros.push({ id: `${day.date}-${cuadros.length}`, label, comment: label, slots })

      for (const group of day.groups) {
        if (group.stage === 'weighing' && group.pairs) {
          chunk(group.pairs, COLUMNS).forEach((pairs, i) => {
            const slots = emptySlots()
            pairs.forEach((pair, col) => {
              slots[col] = pair.scale
              slots[COLUMNS + col] = pair.tacho
            })
            push(i === 0 ? group.label : `${group.label} (cont.)`, slots)
          })
        } else {
          chunk(group.photos, SLOTS_PER_CUADRO).forEach((entries, i) => {
            const slots = emptySlots()
            entries.forEach((entry, k) => {
              slots[k] = entry.photo
            })
            push(i === 0 ? group.label : `${group.label} (cont.)`, slots)
          })
        }
      }
      return { date: day.date, cuadros }
    }),
  }
}

/** Hojas de un día: 4 cuadros por hoja. Un día sin cuadros no tiene hojas. */
export function paginateDay(day: LayoutDay): LayoutCuadro[][] {
  return chunk(day.cuadros, CUADROS_PER_PAGE)
}

function layoutPhotos(layout: ReportLayout): Photo[] {
  return layout.days.flatMap((d) => d.cuadros.flatMap((c) => c.slots)).filter((p): p is Photo => p !== null)
}

/** Urls a descargar para el PDF, sin repetir. */
export function layoutPhotoUrls(layout: ReportLayout): string[] {
  return [...new Set(layoutPhotos(layout).map((p) => p.url))].filter(Boolean)
}

/** Ids de las fotos presentes en algún recuadro (marca "en uso" del buscador). */
export function usedPhotoIds(layout: ReportLayout): Set<string> {
  return new Set(layoutPhotos(layout).map((p) => p.id))
}

// ── Acciones del editor ────────────────────────────────────────────────────
// Puras: devuelven una maqueta nueva, o la misma referencia si no cambia nada.

export interface SlotRef {
  cuadroId: string
  slot: number
}

/** Lo que se arrastra o sobre lo que se suelta (va en `data` de dnd-kit). */
export type DragRef =
  | { type: 'cuadro'; cuadroId: string; date: string }
  | ({ type: 'slot' } & SlotRef)
  | { type: 'browser'; photo: Photo }

function isValidSlotRef(layout: ReportLayout, ref: SlotRef): boolean {
  for (const day of layout.days) {
    const cuadro = day.cuadros.find((c) => c.id === ref.cuadroId)
    if (cuadro && ref.slot >= 0 && ref.slot < cuadro.slots.length) return true
  }
  return false
}

function updateCuadro(layout: ReportLayout, cuadroId: string, fn: (c: LayoutCuadro) => LayoutCuadro): ReportLayout {
  let found = false
  let changed = false
  const newDays = layout.days.map((d) => ({
    ...d,
    cuadros: d.cuadros.map((c) => {
      if (c.id === cuadroId) {
        found = true
        const newC = fn(c)
        if (newC !== c) changed = true
        return newC
      }
      return c
    }),
  }))
  return found && changed ? { days: newDays } : layout
}

export function photoAt(layout: ReportLayout, ref: SlotRef): Photo | null {
  for (const day of layout.days) {
    const cuadro = day.cuadros.find((c) => c.id === ref.cuadroId)
    if (cuadro) return cuadro.slots[ref.slot] ?? null
  }
  return null
}

function setSlot(layout: ReportLayout, ref: SlotRef, photo: Photo | null): ReportLayout {
  if (!isValidSlotRef(layout, ref)) return layout
  return updateCuadro(layout, ref.cuadroId, (c) => {
    const current = c.slots[ref.slot]
    const isSamePhoto = current === photo || (current !== null && photo !== null && current.id === photo.id)
    if (isSamePhoto) return c
    return {
      ...c,
      slots: c.slots.map((p, i) => (i === ref.slot ? photo : p)),
    }
  })
}

/** Lleva el cuadro a la posición de `overCuadroId`. Solo dentro del mismo día. */
export function moveCuadro(layout: ReportLayout, cuadroId: string, overCuadroId: string): ReportLayout {
  if (cuadroId === overCuadroId) return layout
  const day = layout.days.find((d) => d.cuadros.some((c) => c.id === cuadroId))
  if (!day) return layout
  const from = day.cuadros.findIndex((c) => c.id === cuadroId)
  const to = day.cuadros.findIndex((c) => c.id === overCuadroId)
  if (to === -1) return layout
  const cuadros = [...day.cuadros]
  const [moved] = cuadros.splice(from, 1)
  cuadros.splice(to, 0, moved)
  return { days: layout.days.map((d) => (d === day ? { ...d, cuadros } : d)) }
}

export function dropPhoto(layout: ReportLayout, ref: SlotRef, photo: Photo): ReportLayout {
  return setSlot(layout, ref, photo)
}

/** Intercambia dos recuadros; si el destino está vacío, equivale a mover. */
export function swapSlots(layout: ReportLayout, a: SlotRef, b: SlotRef): ReportLayout {
  if (a.cuadroId === b.cuadroId && a.slot === b.slot) return layout
  if (!isValidSlotRef(layout, a) || !isValidSlotRef(layout, b)) return layout
  const pa = photoAt(layout, a)
  const pb = photoAt(layout, b)
  return setSlot(setSlot(layout, a, pb), b, pa)
}

export function clearSlot(layout: ReportLayout, ref: SlotRef): ReportLayout {
  return setSlot(layout, ref, null)
}

export function setComment(layout: ReportLayout, cuadroId: string, comment: string): ReportLayout {
  return updateCuadro(layout, cuadroId, (c) => (c.comment === comment ? c : { ...c, comment }))
}

let newCuadroSeq = 0

/** Cuadro vacío al final del día. */
export function addCuadro(layout: ReportLayout, date: string): ReportLayout {
  const dayExists = layout.days.some((d) => d.date === date)
  if (!dayExists) return layout
  newCuadroSeq += 1
  const cuadro: LayoutCuadro = { id: `nuevo-${newCuadroSeq}`, label: 'Pesaje', comment: 'Pesaje', slots: emptySlots() }
  return { days: layout.days.map((d) => (d.date === date ? { ...d, cuadros: [...d.cuadros, cuadro] } : d)) }
}

export function removeCuadro(layout: ReportLayout, cuadroId: string): ReportLayout {
  const found = layout.days.some((d) => d.cuadros.some((c) => c.id === cuadroId))
  if (!found) return layout
  return { days: layout.days.map((d) => ({ ...d, cuadros: d.cuadros.filter((c) => c.id !== cuadroId) })) }
}

/** Traduce el fin de un arrastre a una acción. Combinaciones sin sentido no cambian nada. */
export function applyDragEnd(layout: ReportLayout, active: DragRef, over: DragRef | null): ReportLayout {
  if (!over) return layout
  if (active.type === 'cuadro') {
    return over.type === 'cuadro' ? moveCuadro(layout, active.cuadroId, over.cuadroId) : layout
  }
  if (over.type !== 'slot') return layout
  if (active.type === 'browser') return dropPhoto(layout, over, active.photo)
  return swapSlots(layout, active, over)
}
