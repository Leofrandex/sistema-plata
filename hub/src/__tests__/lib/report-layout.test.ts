import type { Photo } from '@hospiwaste/shared/lib/types'
import type { PhotographicReportData } from '@/lib/data/reports'
import {
  buildReportLayout,
  paginateDay,
  layoutPhotoUrls,
  usedPhotoIds,
  photoAt,
  moveCuadro,
  dropPhoto,
  swapSlots,
  clearSlot,
  setComment,
  addCuadro,
  removeCuadro,
  applyDragEnd,
  type ReportLayout,
} from '@/lib/data/report-layout'

const ph = (id: string): Photo => ({
  id, url: `u-${id}`, event_type: 'weighing', event_id: 'e', taken_at: '2026-05-17T09:00:00-05:00', label: '',
})

function data(days: PhotographicReportData['days']): PhotographicReportData {
  return {
    company: { id: 'company-ion', name: 'ION' } as PhotographicReportData['company'],
    client: { id: 'client-1', name: 'PTDP' } as PhotographicReportData['client'],
    rangeStart: '2026-05-11', rangeEnd: '2026-05-17', generatedAt: '',
    days,
    meta: { routeEventCount: 0, weighingReceptionCount: 0, routePhotoCount: 0, weighingPhotoCount: 0, totalPhotos: 0 },
  }
}

const routeEntry = (id: string) => ({ photo: ph(id), container_id: null, container: null, taken_at: '', comment: '' })
const pair = (n: number) => ({ container_id: `T${n}`, container: null, scale: ph(`s${n}`), tacho: ph(`t${n}`) })

describe('buildReportLayout', () => {
  it('recorrido: 8 fotos por cuadro en orden, fila por fila, y corta en "(cont.)"', () => {
    const photos = Array.from({ length: 10 }, (_, i) => routeEntry(`r${i}`))
    const layout = buildReportLayout(data([{ date: '2026-05-17', groups: [{ label: 'Recorrido — 1.ª ruta', stage: 'route', photos }] }]))
    const [a, b] = layout.days[0].cuadros
    expect(a.label).toBe('Recorrido — 1.ª ruta')
    expect(a.comment).toBe('Recorrido — 1.ª ruta')
    expect(a.slots.map((p) => p?.id)).toEqual(['r0', 'r1', 'r2', 'r3', 'r4', 'r5', 'r6', 'r7'])
    expect(b.label).toBe('Recorrido — 1.ª ruta (cont.)')
    expect(b.slots.map((p) => p?.id ?? null)).toEqual(['r8', 'r9', null, null, null, null, null, null])
  })

  it('pesaje: par i en la columna i — balanza arriba, tacho abajo; 4 pares por cuadro', () => {
    const pairs = [1, 2, 3, 4, 5].map(pair)
    const layout = buildReportLayout(data([{ date: '2026-05-17', groups: [{ label: 'Pesaje — 1.ª ruta', stage: 'weighing', photos: [], pairs }] }]))
    const [a, b] = layout.days[0].cuadros
    expect(a.slots.map((p) => p?.id)).toEqual(['s1', 's2', 's3', 's4', 't1', 't2', 't3', 't4'])
    expect(b.label).toBe('Pesaje — 1.ª ruta (cont.)')
    expect(b.slots.map((p) => p?.id ?? null)).toEqual(['s5', null, null, null, 't5', null, null, null])
  })

  it('ids de cuadro únicos y estables entre llamadas', () => {
    const d = data([{ date: '2026-05-17', groups: [
      { label: 'R', stage: 'route', photos: [routeEntry('r0')] },
      { label: 'P', stage: 'weighing', photos: [], pairs: [pair(1)] },
    ] }])
    const ids = buildReportLayout(d).days[0].cuadros.map((c) => c.id)
    expect(new Set(ids).size).toBe(2)
    expect(buildReportLayout(d).days[0].cuadros.map((c) => c.id)).toEqual(ids)
  })
})

describe('paginateDay', () => {
  const cuadro = (id: string) => ({ id, label: id, comment: id, slots: [] })
  it('4 cuadros por hoja', () => {
    const pages = paginateDay({ date: 'd', cuadros: ['a', 'b', 'c', 'd', 'e'].map(cuadro) })
    expect(pages.map((p) => p.map((c) => c.id))).toEqual([['a', 'b', 'c', 'd'], ['e']])
  })
  it('un día sin cuadros no produce hojas', () => {
    expect(paginateDay({ date: 'd', cuadros: [] })).toEqual([])
  })
})

describe('layoutPhotoUrls / usedPhotoIds', () => {
  const layout: ReportLayout = { days: [{ date: 'd', cuadros: [
    { id: 'a', label: '', comment: '', slots: [ph('x'), null, ph('y')] },
    { id: 'b', label: '', comment: '', slots: [ph('x')] },
  ] }] }
  it('la misma foto en dos recuadros se descarga una sola vez', () => {
    expect(layoutPhotoUrls(layout).sort()).toEqual(['u-x', 'u-y'])
  })
  it('fotos en uso por id', () => {
    expect([...usedPhotoIds(layout)].sort()).toEqual(['x', 'y'])
  })
})

describe('acciones del editor', () => {
  const base = (): ReportLayout => ({ days: [
    { date: 'd1', cuadros: [
      { id: 'a', label: 'A', comment: 'A', slots: [ph('1'), ph('2'), null, null, null, null, null, null] },
      { id: 'b', label: 'B', comment: 'B', slots: [ph('3'), null, null, null, null, null, null, null] },
      { id: 'c', label: 'C', comment: 'C', slots: Array(8).fill(null) },
    ] },
    { date: 'd2', cuadros: [{ id: 'z', label: 'Z', comment: 'Z', slots: Array(8).fill(null) }] },
  ] })
  const ids = (l: ReportLayout, day = 0) => l.days[day].cuadros.map((c) => c.id)

  it('moveCuadro reordena dentro del día', () => {
    expect(ids(moveCuadro(base(), 'a', 'c'))).toEqual(['b', 'c', 'a'])
    expect(ids(moveCuadro(base(), 'c', 'a'))).toEqual(['c', 'a', 'b'])
  })

  it('moveCuadro no cruza días', () => {
    const l = base()
    expect(moveCuadro(l, 'a', 'z')).toBe(l)
  })

  it('dropPhoto reemplaza lo que había', () => {
    const l = dropPhoto(base(), { cuadroId: 'a', slot: 0 }, ph('9'))
    expect(photoAt(l, { cuadroId: 'a', slot: 0 })?.id).toBe('9')
  })

  it('swapSlots intercambia entre cuadros y mueve si el destino está vacío', () => {
    const l = swapSlots(base(), { cuadroId: 'a', slot: 0 }, { cuadroId: 'b', slot: 0 })
    expect(photoAt(l, { cuadroId: 'a', slot: 0 })?.id).toBe('3')
    expect(photoAt(l, { cuadroId: 'b', slot: 0 })?.id).toBe('1')
    const m = swapSlots(base(), { cuadroId: 'a', slot: 1 }, { cuadroId: 'c', slot: 5 })
    expect(photoAt(m, { cuadroId: 'a', slot: 1 })).toBeNull()
    expect(photoAt(m, { cuadroId: 'c', slot: 5 })?.id).toBe('2')
  })

  it('clearSlot vacía; setComment edita', () => {
    expect(photoAt(clearSlot(base(), { cuadroId: 'a', slot: 0 }), { cuadroId: 'a', slot: 0 })).toBeNull()
    expect(setComment(base(), 'b', 'Hola').days[0].cuadros[1].comment).toBe('Hola')
  })

  it('addCuadro agrega uno vacío al final del día, con id nuevo', () => {
    const l = addCuadro(base(), 'd1')
    const added = l.days[0].cuadros[3]
    expect(added.label).toBe('Pesaje')
    expect(added.comment).toBe('Pesaje')
    expect(added.slots).toEqual(Array(8).fill(null))
    expect(['a', 'b', 'c', 'z']).not.toContain(added.id)
    expect(addCuadro(l, 'd1').days[0].cuadros[4].id).not.toBe(added.id)
  })

  it('removeCuadro elimina; el día puede quedar vacío', () => {
    expect(ids(removeCuadro(base(), 'b'))).toEqual(['a', 'c'])
    expect(removeCuadro(base(), 'z').days[1].cuadros).toEqual([])
  })

  describe('applyDragEnd', () => {
    it('cuadro sobre cuadro del mismo día: reordena', () => {
      const l = applyDragEnd(base(), { type: 'cuadro', cuadroId: 'a', date: 'd1' }, { type: 'cuadro', cuadroId: 'b', date: 'd1' })
      expect(ids(l)).toEqual(['b', 'a', 'c'])
    })
    it('cuadro sobre cuadro de otro día: no cambia nada', () => {
      const l = base()
      expect(applyDragEnd(l, { type: 'cuadro', cuadroId: 'a', date: 'd1' }, { type: 'cuadro', cuadroId: 'z', date: 'd2' })).toBe(l)
    })
    it('foto del buscador sobre un recuadro: la suelta ahí', () => {
      const l = applyDragEnd(base(), { type: 'browser', photo: ph('9') }, { type: 'slot', cuadroId: 'z', slot: 7 })
      expect(photoAt(l, { cuadroId: 'z', slot: 7 })?.id).toBe('9')
    })
    it('foto del canvas sobre otro recuadro: intercambia', () => {
      const l = applyDragEnd(base(), { type: 'slot', cuadroId: 'a', slot: 0 }, { type: 'slot', cuadroId: 'a', slot: 1 })
      expect(photoAt(l, { cuadroId: 'a', slot: 0 })?.id).toBe('2')
      expect(photoAt(l, { cuadroId: 'a', slot: 1 })?.id).toBe('1')
    })
    it('foto sobre su propio recuadro, o soltada fuera: no cambia nada', () => {
      const l = base()
      expect(applyDragEnd(l, { type: 'slot', cuadroId: 'a', slot: 0 }, { type: 'slot', cuadroId: 'a', slot: 0 })).toBe(l)
      expect(applyDragEnd(l, { type: 'browser', photo: ph('9') }, null)).toBe(l)
    })
  })

  describe('contrato no-op: misma referencia cuando no cambia nada', () => {
    it('clearSlot en un recuadro vacío devuelve la misma maqueta', () => {
      const l = base()
      expect(clearSlot(l, { cuadroId: 'c', slot: 0 })).toBe(l)
    })
    it('setComment con el mismo texto devuelve la misma maqueta', () => {
      const l = base()
      expect(setComment(l, 'a', 'A')).toBe(l)
    })
    it('setComment con id desconocido devuelve la misma maqueta', () => {
      const l = base()
      expect(setComment(l, 'unknown', 'algo')).toBe(l)
    })
    it('dropPhoto de la misma foto ya presente devuelve la misma maqueta', () => {
      const l = base()
      expect(dropPhoto(l, { cuadroId: 'a', slot: 0 }, ph('1'))).toBe(l)
    })
    it('swapSlots de dos recuadros vacíos devuelve la misma maqueta', () => {
      const l = base()
      expect(swapSlots(l, { cuadroId: 'c', slot: 0 }, { cuadroId: 'c', slot: 1 })).toBe(l)
    })
    it('swapSlots con b = cuadro desconocido devuelve la misma maqueta y preserva la foto de a', () => {
      const l = base()
      expect(swapSlots(l, { cuadroId: 'a', slot: 0 }, { cuadroId: 'unknown', slot: 0 })).toBe(l)
      expect(photoAt(l, { cuadroId: 'a', slot: 0 })?.id).toBe('1')
    })
    it('removeCuadro con id desconocido devuelve la misma maqueta', () => {
      const l = base()
      expect(removeCuadro(l, 'unknown')).toBe(l)
    })
    it('addCuadro con fecha desconocida devuelve la misma maqueta', () => {
      const l = base()
      expect(addCuadro(l, 'unknown-date')).toBe(l)
    })
  })
})
