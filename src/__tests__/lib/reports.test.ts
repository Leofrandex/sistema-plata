import {
  buildPhotographicReportData,
  getMondayOfWeek,
  isoDate,
  chunk,
} from '@/lib/data/reports'
import type { ReportStoreSlice } from '@/lib/data/reports'
import {
  MOCK_CLIENTS,
  MOCK_COMPANIES,
  MOCK_CONTAINERS,
  MOCK_ROUTE_EVENTS,
  MOCK_WEIGHING_SESSIONS,
  MOCK_RECEPTIONS,
  MOCK_PHOTOS,
} from '@/lib/mock-data'

describe('getMondayOfWeek', () => {
  it('returns the same date when reference is Monday', () => {
    const monday = new Date(2026, 4, 11, 14, 32)
    expect(isoDate(getMondayOfWeek(monday))).toBe('2026-05-11')
    expect(getMondayOfWeek(monday).getHours()).toBe(0)
  })
  it('returns previous Monday when reference is Wednesday', () => {
    expect(isoDate(getMondayOfWeek(new Date(2026, 4, 13, 10, 0)))).toBe('2026-05-11')
  })
  it('returns previous Monday when reference is Sunday', () => {
    expect(isoDate(getMondayOfWeek(new Date(2026, 4, 17, 23, 59)))).toBe('2026-05-11')
  })
})

describe('chunk', () => {
  it('parte en sub-arrays del tamaño dado', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]])
  })
})

describe('buildPhotographicReportData (por empresa)', () => {
  const store: ReportStoreSlice = {
    clients: MOCK_CLIENTS,
    companies: MOCK_COMPANIES,
    containers: MOCK_CONTAINERS,
    routeEvents: MOCK_ROUTE_EVENTS,
    weighingSessions: MOCK_WEIGHING_SESSIONS,
    receptions: MOCK_RECEPTIONS,
    photos: MOCK_PHOTOS,
  }
  const range = { start: new Date(2026, 4, 11, 0, 0), end: new Date(2026, 4, 17, 23, 59) }

  it('returns null when company does not exist', () => {
    expect(buildPhotographicReportData('nonexistent', store, range)).toBeNull()
  })

  it('arma el reporte de ION ordenado por ruta (recorrido luego pesaje)', () => {
    const data = buildPhotographicReportData('company-ion', store, range)!
    expect(data.company.name).toBe('ION')
    expect(data.rangeStart).toBe('2026-05-11')
    expect(data.rangeEnd).toBe('2026-05-17')

    // Un solo día con actividad
    expect(data.days.length).toBe(1)
    const day = data.days[0]
    expect(day.date).toBe('2026-05-17')

    // Orden de grupos: Recorrido 1ra, Pesaje 1ra, Recorrido 2da
    // (Pesaje 2da se omite: I-003 no tiene reception)
    const labels = day.groups.map((g) => g.label)
    expect(labels[0]).toContain('Recorrido')
    expect(labels[0]).toContain('1.ª')
    expect(labels[1]).toContain('Pesaje')
    expect(labels[1]).toContain('1.ª')
    expect(labels[2]).toContain('Recorrido')
    expect(labels[2]).toContain('2.ª')

    // Conteos de fotos
    expect(data.meta.routePhotoCount).toBe(5) // r1: 3, r2: 2
    expect(data.meta.weighingPhotoCount).toBe(4) // reception-1 (2) + reception-2 (2)
    expect(data.meta.totalPhotos).toBe(9)
    expect(data.meta.routeEventCount).toBe(2)
    expect(data.meta.weighingReceptionCount).toBe(2)
  })

  it('procesa pesajes históricos sin recorrido (Airkem) sin fallar', () => {
    const airkem = buildPhotographicReportData('company-airkem', store, range)!
    // Airkem tiene receptions históricas (sin route_events que las recojan en rango)
    expect(airkem.meta.weighingReceptionCount).toBeGreaterThan(0)
    // Las recepciones históricas no tienen fotos → no generan cuadros (grupos
    // vacíos se omiten), así que el reporte no rompe y solo cuenta fotos reales.
    expect(airkem.meta.weighingPhotoCount).toBe(airkem.days.reduce(
      (n, d) => n + d.groups.filter((g) => g.stage === 'weighing').reduce((m, g) => m + g.photos.length, 0),
      0,
    ))
  })

  it('agrupa pesajes huérfanos con fotos por su fecha de pesaje', () => {
    // I-001 recogido en route-1; si quitamos sus route_events, la reception-1
    // (con 2 fotos) queda huérfana y debe aparecer como grupo 'Pesaje'.
    const noRoutes: ReportStoreSlice = { ...store, routeEvents: [] }
    const data = buildPhotographicReportData('company-ion', noRoutes, range)!
    const weighingGroups = data.days.flatMap((d) => d.groups.filter((g) => g.stage === 'weighing'))
    expect(weighingGroups.length).toBeGreaterThan(0)
    expect(weighingGroups.every((g) => g.label === 'Pesaje')).toBe(true)
    expect(data.meta.weighingPhotoCount).toBe(4)
    expect(data.meta.routePhotoCount).toBe(0)
  })

  it('devuelve vacío cuando el rango no tiene actividad', () => {
    const empty = { start: new Date(2027, 0, 1), end: new Date(2027, 0, 15, 23, 59) }
    const data = buildPhotographicReportData('company-ion', store, empty)!
    expect(data.meta.totalPhotos).toBe(0)
    expect(data.days).toEqual([])
  })

  it('empresa registrada en reception sobreescribe empresa-dueña del tacho', () => {
    // Container A-050 es de Airkem, pero la reception tiene company_id='company-ion'
    // → el reporte de ION debe contar esa reception; el de Airkem NO.
    const isoStore: ReportStoreSlice = {
      clients: MOCK_CLIENTS,
      companies: MOCK_COMPANIES,
      containers: [
        { id: 'A-050', company_id: 'company-airkem', size_liters: 240, tare_weight_kg: 14.0, status: 'active', registered_at: '2026-01-01T00:00:00Z' },
      ],
      routeEvents: [],
      weighingSessions: [],
      receptions: [
        {
          id: 'reception-iso-1',
          container_id: 'A-050',
          weighing_session_id: null,
          arrived_at: '2026-05-14T09:00:00-05:00',
          gross_weight_kg: 30.0,
          operator_id: 'user-1',
          photo_ids: ['photo-iso-1'],
          observations: '',
          company_id: 'company-ion', // snapshot registrado: pertenece a ION
        },
      ],
      photos: [
        { id: 'photo-iso-1', url: 'https://placehold.co/400x300?text=iso', event_type: 'weighing', event_id: 'reception-iso-1', taken_at: '2026-05-14T09:00:00-05:00', label: 'Test iso' },
      ],
    }
    const isoRange = { start: new Date(2026, 4, 11, 0, 0), end: new Date(2026, 4, 17, 23, 59) }

    const ionReport = buildPhotographicReportData('company-ion', isoStore, isoRange)!
    expect(ionReport.meta.weighingReceptionCount).toBe(1)

    const airkemReport = buildPhotographicReportData('company-airkem', isoStore, isoRange)!
    expect(airkemReport.meta.weighingReceptionCount).toBe(0)
  })
})
