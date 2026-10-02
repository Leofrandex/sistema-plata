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
