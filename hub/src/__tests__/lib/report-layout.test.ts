import type { Photo } from '@hospiwaste/shared/lib/types'
import type { PhotographicReportData } from '@/lib/data/reports'
import {
  buildReportLayout,
  paginateDay,
  layoutPhotoUrls,
  usedPhotoIds,
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
