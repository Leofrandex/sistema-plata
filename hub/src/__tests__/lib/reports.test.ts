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
} from '@hospiwaste/shared/lib/mock-data'

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
  // Fixture Airkem — usa el pool histórico real para las pruebas de Airkem
  const airkemStore: ReportStoreSlice = {
    clients: MOCK_CLIENTS,
    companies: MOCK_COMPANIES,
    containers: MOCK_CONTAINERS,
    routeEvents: MOCK_ROUTE_EVENTS,
    weighingSessions: MOCK_WEIGHING_SESSIONS,
    receptions: MOCK_RECEPTIONS,
    photos: MOCK_PHOTOS,
  }
  const range = { start: new Date(2026, 4, 11, 0, 0), end: new Date(2026, 4, 17, 23, 59) }

  // Fixture ION auto-contenido: usa contenedores A- asignados a company-ion para
  // poder testear la lógica de orden sin depender del pool real Airkem.
  const ionContainers = [
    { id: 'A-901', company_id: 'company-ion', size_liters: 240, tare_weight_kg: 14.2, status: 'active' as const, registered_at: '2026-01-15T08:00:00Z' },
    { id: 'A-902', company_id: 'company-ion', size_liters: 240, tare_weight_kg: 14.5, status: 'active' as const, registered_at: '2026-01-15T08:00:00Z' },
    { id: 'A-903', company_id: 'company-ion', size_liters: 240, tare_weight_kg: 14.1, status: 'active' as const, registered_at: '2026-01-15T08:00:00Z' },
  ]
  const ionStore: ReportStoreSlice = {
    clients: MOCK_CLIENTS,
    companies: MOCK_COMPANIES,
    containers: ionContainers,
    routeEvents: [
      {
        id: 'route-ion-1',
        client_id: 'client-1',
        company_id: 'company-ion',
        kind: 'anden',
        slot: '06:30',
        date: '2026-05-17',
        started_at: '2026-05-17T06:30:00-05:00',
        ended_at: '2026-05-17T08:12:00-05:00',
        operator_id: 'user-1',
        status: 'completed',
        containers_dirty_received: ['A-901', 'A-902'],
        containers_clean_delivered: [],
        area: 'Emergencias',
        photo_ids: ['photo-ion-r1-1', 'photo-ion-r1-2', 'photo-ion-r1-3'],
      },
      {
        id: 'route-ion-2',
        client_id: 'client-1',
        company_id: 'company-ion',
        kind: 'anden',
        slot: '10:30',
        date: '2026-05-17',
        started_at: '2026-05-17T10:30:00-05:00',
        ended_at: '2026-05-17T11:45:00-05:00',
        operator_id: 'user-2',
        status: 'completed',
        containers_dirty_received: ['A-903'],
        containers_clean_delivered: [],
        area: 'Pediatría',
        photo_ids: ['photo-ion-r2-1', 'photo-ion-r2-2'],
      },
    ],
    weighingSessions: [],
    receptions: [
      {
        id: 'reception-ion-1',
        container_id: 'A-901',
        weighing_session_id: null,
        arrived_at: '2026-05-17T09:15:00-05:00',
        gross_weight_kg: 43.7,
        operator_id: 'user-1',
        photo_ids: ['photo-ion-w1-1', 'photo-ion-w1-2'],
        observations: '',
        company_id: 'company-ion',
      },
      {
        id: 'reception-ion-2',
        container_id: 'A-902',
        weighing_session_id: null,
        arrived_at: '2026-05-17T09:20:00-05:00',
        gross_weight_kg: 38.2,
        operator_id: 'user-1',
        photo_ids: ['photo-ion-w2-1', 'photo-ion-w2-2'],
        observations: '',
        company_id: 'company-ion',
      },
      // A-903 recogida en route-ion-2 pero sin reception → Pesaje 2da se omite
    ],
    photos: [
      { id: 'photo-ion-r1-1', url: 'https://placehold.co/400x300?text=R1', event_type: 'route', event_id: 'route-ion-1', taken_at: '2026-05-17T07:00:00-05:00', label: 'R1' },
      { id: 'photo-ion-r1-2', url: 'https://placehold.co/400x300?text=R2', event_type: 'route', event_id: 'route-ion-1', taken_at: '2026-05-17T07:15:00-05:00', label: 'R2' },
      { id: 'photo-ion-r1-3', url: 'https://placehold.co/400x300?text=R3', event_type: 'route', event_id: 'route-ion-1', taken_at: '2026-05-17T07:30:00-05:00', label: 'R3' },
      { id: 'photo-ion-r2-1', url: 'https://placehold.co/400x300?text=R4', event_type: 'route', event_id: 'route-ion-2', taken_at: '2026-05-17T11:00:00-05:00', label: 'R4' },
      { id: 'photo-ion-r2-2', url: 'https://placehold.co/400x300?text=R5', event_type: 'route', event_id: 'route-ion-2', taken_at: '2026-05-17T11:15:00-05:00', label: 'R5' },
      { id: 'photo-ion-w1-1', url: 'https://placehold.co/400x300?text=W1', event_type: 'weighing', event_id: 'reception-ion-1', taken_at: '2026-05-17T09:15:00-05:00', label: 'W1' },
      { id: 'photo-ion-w1-2', url: 'https://placehold.co/400x300?text=W2', event_type: 'weighing', event_id: 'reception-ion-1', taken_at: '2026-05-17T09:16:00-05:00', label: 'W2' },
      { id: 'photo-ion-w2-1', url: 'https://placehold.co/400x300?text=W3', event_type: 'weighing', event_id: 'reception-ion-2', taken_at: '2026-05-17T09:20:00-05:00', label: 'W3' },
      { id: 'photo-ion-w2-2', url: 'https://placehold.co/400x300?text=W4', event_type: 'weighing', event_id: 'reception-ion-2', taken_at: '2026-05-17T09:21:00-05:00', label: 'W4' },
    ],
  }

  it('returns null when company does not exist', () => {
    expect(buildPhotographicReportData('nonexistent', airkemStore, range)).toBeNull()
  })

  it('arma el reporte de ION ordenado por ruta (recorrido luego pesaje)', () => {
    const data = buildPhotographicReportData('company-ion', ionStore, range)!
    expect(data.company.name).toBe('ION')
    expect(data.rangeStart).toBe('2026-05-11')
    expect(data.rangeEnd).toBe('2026-05-17')

    // Un solo día con actividad
    expect(data.days.length).toBe(1)
    const day = data.days[0]
    expect(day.date).toBe('2026-05-17')

    // Orden de grupos: Recorrido 1ra, Pesaje 1ra, Recorrido 2da
    // (Pesaje 2da se omite: A-903 no tiene reception)
    const labels = day.groups.map((g) => g.label)
    expect(labels[0]).toContain('Recorrido')
    expect(labels[0]).toContain('1.ª')
    expect(labels[1]).toContain('Pesaje')
    expect(labels[1]).toContain('1.ª')
    expect(labels[2]).toContain('Recorrido')
    expect(labels[2]).toContain('2.ª')

    // Conteos de fotos
    expect(data.meta.routePhotoCount).toBe(5) // r1: 3, r2: 2
    expect(data.meta.weighingPhotoCount).toBe(4) // reception-ion-1 (2) + reception-ion-2 (2)
    expect(data.meta.totalPhotos).toBe(9)
    expect(data.meta.routeEventCount).toBe(2)
    expect(data.meta.weighingReceptionCount).toBe(2)
  })

  it('procesa pesajes históricos sin recorrido (Airkem) sin fallar', () => {
    const airkem = buildPhotographicReportData('company-airkem', airkemStore, range)!
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
    // A-901 recogido en route-ion-1; si quitamos route_events, la reception-ion-1
    // (con 2 fotos) queda huérfana y debe aparecer como grupo 'Pesaje'.
    const noRoutes: ReportStoreSlice = { ...ionStore, routeEvents: [] }
    const data = buildPhotographicReportData('company-ion', noRoutes, range)!
    const weighingGroups = data.days.flatMap((d) => d.groups.filter((g) => g.stage === 'weighing'))
    expect(weighingGroups.length).toBeGreaterThan(0)
    expect(weighingGroups.every((g) => g.label === 'Pesaje')).toBe(true)
    expect(data.meta.weighingPhotoCount).toBe(4)
    expect(data.meta.routePhotoCount).toBe(0)
  })

  it('devuelve vacío cuando el rango no tiene actividad', () => {
    const empty = { start: new Date(2027, 0, 1), end: new Date(2027, 0, 15, 23, 59) }
    const data = buildPhotographicReportData('company-ion', ionStore, empty)!
    expect(data.meta.totalPhotos).toBe(0)
    expect(data.days).toEqual([])
  })

  it('excluye route_events y receptions anulados (voided_at) del reporte', () => {
    // Partimos del ionStore y añadimos:
    //  - Un route event ANULADO (voided_at set) con sus propias fotos de ruta
    //  - Una reception ANULADA (voided_at set) con sus propias fotos de pesaje
    // Solo los no-anulados deben aparecer en el reporte.
    const voidedRoute = {
      id: 'route-ion-voided',
      client_id: 'client-1',
      company_id: 'company-ion',
      kind: 'anden' as const,
      slot: '14:30' as const,
      date: '2026-05-17',
      started_at: '2026-05-17T14:30:00-05:00',
      ended_at: '2026-05-17T15:30:00-05:00',
      operator_id: 'user-1',
      status: 'completed' as const,
      containers_dirty_received: ['A-901'],
      containers_clean_delivered: [],
      area: 'Laboratorio',
      photo_ids: ['photo-ion-void-r1'],
      voided_at: '2026-06-01T10:00:00Z',
    }
    const voidedReception = {
      id: 'reception-ion-voided',
      container_id: 'A-902',
      weighing_session_id: null,
      arrived_at: '2026-05-17T15:30:00-05:00',
      gross_weight_kg: 50.0,
      operator_id: 'user-1',
      photo_ids: ['photo-ion-void-w1'],
      observations: '',
      company_id: 'company-ion',
      voided_at: '2026-06-01T10:00:00Z',
    }

    const storeWithVoided: ReportStoreSlice = {
      ...ionStore,
      routeEvents: [...ionStore.routeEvents, voidedRoute],
      receptions: [...ionStore.receptions, voidedReception],
      photos: [
        ...ionStore.photos,
        { id: 'photo-ion-void-r1', url: 'https://placehold.co/400x300?text=VOID-R', event_type: 'route' as const, event_id: 'route-ion-voided', taken_at: '2026-05-17T14:30:00-05:00', label: 'VOID-R' },
        { id: 'photo-ion-void-w1', url: 'https://placehold.co/400x300?text=VOID-W', event_type: 'weighing' as const, event_id: 'reception-ion-voided', taken_at: '2026-05-17T15:30:00-05:00', label: 'VOID-W' },
      ],
    }

    const data = buildPhotographicReportData('company-ion', storeWithVoided, range)!

    // El route event anulado NO debe incrementar el conteo (2 rutas válidas, no 3)
    expect(data.meta.routeEventCount).toBe(2)
    // La reception anulada NO debe incrementar el conteo (2 recepciones válidas, no 3)
    expect(data.meta.weighingReceptionCount).toBe(2)

    // Las fotos del route event anulado NO deben aparecer en el reporte
    const allPhotoIds = data.days
      .flatMap((d) => d.groups)
      .flatMap((g) => g.photos)
      .map((e) => e.photo.id)
    expect(allPhotoIds).not.toContain('photo-ion-void-r1')
    expect(allPhotoIds).not.toContain('photo-ion-void-w1')

    // Los no-anulados siguen presentes
    expect(data.meta.routePhotoCount).toBe(5)   // r1: 3, r2: 2
    expect(data.meta.weighingPhotoCount).toBe(4) // reception-ion-1 (2) + reception-ion-2 (2)
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

  it('pares de pesaje: scale = photo_ids[1], tacho = photo_ids[0]', () => {
    const data = buildPhotographicReportData('company-ion', ionStore, range)!
    const wGroup = data.days[0].groups.find((g) => g.stage === 'weighing' && g.pairs)!
    expect(wGroup.pairs).toBeDefined()
    // reception-ion-1: photo_ids ['photo-ion-w1-1' (tacho), 'photo-ion-w1-2' (peso)]
    expect(wGroup.pairs![0].tacho!.id).toBe('photo-ion-w1-1')
    expect(wGroup.pairs![0].scale!.id).toBe('photo-ion-w1-2')
    // El conteo de fotos de pesaje no cambia
    expect(data.meta.weighingPhotoCount).toBe(4)
  })

  it('excluye la foto de firma del recorrido (signature_photo_id)', () => {
    const withSig: ReportStoreSlice = {
      ...ionStore,
      routeEvents: ionStore.routeEvents.map((e) =>
        e.id === 'route-ion-1'
          ? { ...e, photo_ids: [...e.photo_ids, 'photo-ion-sig'], signature_photo_id: 'photo-ion-sig' }
          : e,
      ),
      photos: [
        ...ionStore.photos,
        { id: 'photo-ion-sig', url: 'https://placehold.co/400x300?text=SIG', event_type: 'route' as const, event_id: 'route-ion-1', taken_at: '2026-05-17T07:45:00-05:00', label: 'Firma' },
      ],
    }
    const data = buildPhotographicReportData('company-ion', withSig, range)!
    const allPhotoIds = data.days.flatMap((d) => d.groups).flatMap((g) => g.photos).map((e) => e.photo.id)
    expect(allPhotoIds).not.toContain('photo-ion-sig')
    // sigue contando solo las 5 fotos de ruta reales (no la firma)
    expect(data.meta.routePhotoCount).toBe(5)
  })
})
