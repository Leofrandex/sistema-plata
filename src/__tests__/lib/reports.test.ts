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
  })

  it('returns previous Monday when reference is Wednesday', () => {
    const wed = new Date(2026, 4, 13, 10, 0)
    expect(isoDate(getMondayOfWeek(wed))).toBe('2026-05-11')
  })

  it('returns previous Monday when reference is Sunday', () => {
    const sun = new Date(2026, 4, 17, 23, 59)
    expect(isoDate(getMondayOfWeek(sun))).toBe('2026-05-11')
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

  it('returns null when company does not exist', () => {
    expect(buildPhotographicReportData('nonexistent', store)).toBeNull()
  })

  it('returns a report scoped to one company (ION)', () => {
    const end = new Date(2026, 4, 17, 23, 59)
    const data = buildPhotographicReportData('company-ion', store, end)!
    expect(data.company.name).toBe('ION')
    expect(data.client.name).toBe('Centro de la Salud')
    expect(data.weekStart).toBe('2026-05-11')
    expect(data.weekEnd).toBe('2026-05-17')
    // ION tiene 2 routeEvents (route-1, route-2) y 2 receptions de hoy
    expect(data.meta.routeEventCount).toBe(2)
    expect(data.meta.weighingReceptionCount).toBe(2)
    // byStage.route es array plano de ReportPhotoEntry
    expect(Array.isArray(data.byStage.route)).toBe(true)
    expect(Array.isArray(data.byStage.weighing)).toBe(true)
    expect(data.byStage.weighing.length).toBe(4) // 2 receptions × 2 fotos
  })

  it('separa fotos de empresas distintas en el mismo recorrido', () => {
    const end = new Date(2026, 4, 17, 23, 59)
    const ion = buildPhotographicReportData('company-ion', store, end)!
    const airkem = buildPhotographicReportData('company-airkem', store, end)!
    // Airkem tiene los mismos recorridos (porque incluyen envases de ambas
    // empresas) pero el comentario solo lista los envases de cada empresa.
    expect(ion.meta.routeEventCount).toBe(airkem.meta.routeEventCount)
    // Airkem en la semana 11-17 de mayo: 106 receptions históricas del día 11
    // (último día capturado en el Excel) + 0 del mock vivo de esta semana = 106
    expect(airkem.meta.weighingReceptionCount).toBe(106)
  })

  it('returns empty when range has no activity', () => {
    const end = new Date(2027, 0, 15, 23, 59)
    const data = buildPhotographicReportData('company-ion', store, end)!
    expect(data.meta.totalPhotos).toBe(0)
    expect(data.byStage.route).toEqual([])
    expect(data.byStage.weighing).toEqual([])
  })
})
