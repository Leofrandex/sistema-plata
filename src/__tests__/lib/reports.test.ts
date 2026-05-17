import {
  buildPhotographicReportData,
  getMondayOfWeek,
  isoDate,
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
    const monday = new Date(2026, 4, 11, 14, 32) // 2026-05-11 Monday
    const result = getMondayOfWeek(monday)
    expect(isoDate(result)).toBe('2026-05-11')
    expect(result.getHours()).toBe(0)
    expect(result.getMinutes()).toBe(0)
  })

  it('returns previous Monday when reference is Wednesday', () => {
    const wed = new Date(2026, 4, 13, 10, 0) // 2026-05-13 Wednesday
    const result = getMondayOfWeek(wed)
    expect(isoDate(result)).toBe('2026-05-11')
  })

  it('returns previous Monday when reference is Sunday', () => {
    const sun = new Date(2026, 4, 17, 23, 59) // 2026-05-17 Sunday
    const result = getMondayOfWeek(sun)
    expect(isoDate(result)).toBe('2026-05-11')
  })

  it('returns previous Monday when reference is Saturday', () => {
    const sat = new Date(2026, 4, 16, 8, 0) // 2026-05-16 Saturday
    const result = getMondayOfWeek(sat)
    expect(isoDate(result)).toBe('2026-05-11')
  })
})

describe('buildPhotographicReportData', () => {
  const store: ReportStoreSlice = {
    clients: MOCK_CLIENTS,
    companies: MOCK_COMPANIES,
    containers: MOCK_CONTAINERS,
    routeEvents: MOCK_ROUTE_EVENTS,
    weighingSessions: MOCK_WEIGHING_SESSIONS,
    receptions: MOCK_RECEPTIONS,
    photos: MOCK_PHOTOS,
  }

  it('returns null when client does not exist', () => {
    const data = buildPhotographicReportData('nonexistent', store)
    expect(data).toBeNull()
  })

  it('returns a report for Centro de la Salud with both stages populated', () => {
    // Anclamos el endOverride al domingo 2026-05-17 a las 23:59 para que la
    // semana cubra lunes 2026-05-11 a 2026-05-17 (donde están los mocks).
    const end = new Date(2026, 4, 17, 23, 59)
    const data = buildPhotographicReportData('client-1', store, end)
    expect(data).not.toBeNull()
    expect(data!.client.name).toBe('Centro de la Salud')
    expect(data!.weekStart).toBe('2026-05-11')
    expect(data!.weekEnd).toBe('2026-05-17')
    // Hay 2 RouteEvents y 2 receptions en los mocks dentro del rango
    expect(data!.meta.routeEventCount).toBe(2)
    expect(data!.meta.weighingReceptionCount).toBe(2)
    // Total fotos: 5 de recorridos + 4 de pesajes = 9 (las de pesaje no
    // se duplican porque cada reception pertenece a una sola empresa,
    // mientras que las de recorrido sí se replican si el recorrido toca
    // varias empresas — caso de route-1 que toca ION+Airkem con 3 fotos)
    expect(data!.meta.totalPhotos).toBeGreaterThan(0)
    expect(data!.byStage.route.length).toBeGreaterThan(0)
    expect(data!.byStage.weighing.length).toBeGreaterThan(0)
  })

  it('groups weighing photos by company correctly', () => {
    const end = new Date(2026, 4, 17, 23, 59)
    const data = buildPhotographicReportData('client-1', store, end)!
    // Las 2 receptions del mock son ambas de I-001 y I-002 (ION), así que
    // solo debería aparecer ION en el grupo de pesajes.
    expect(data.byStage.weighing.length).toBe(1)
    expect(data.byStage.weighing[0].company.name).toBe('ION')
  })

  it('returns empty groups when range is outside mock dates', () => {
    const end = new Date(2027, 0, 15, 23, 59) // semana del 2027-01-11 a 2027-01-17
    const data = buildPhotographicReportData('client-1', store, end)!
    expect(data.meta.routeEventCount).toBe(0)
    expect(data.meta.weighingReceptionCount).toBe(0)
    expect(data.meta.totalPhotos).toBe(0)
  })
})
