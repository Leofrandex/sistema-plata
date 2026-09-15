import {
  HISTORICAL_CUTOVER,
  comparePeriod,
  dailyKgFromLive,
  historicalMonthlyKgByCompany,
  mergeMonthlyByCompany,
  monthlyComparisonPoints,
  rollupByCompany,
  rollupByMonth,
  rollupByYear,
  unifiedDailyKg,
  yearlyMonthlySeries,
} from '@hospiwaste/shared/lib/data/historical-kg'
import type { HistoricalDailyKgRow } from '@hospiwaste/shared/lib/supabase/queries/historical-kg'
import type { Company, Container, ContainerReception } from '@hospiwaste/shared/lib/types'

// ─── Fixtures ────────────────────────────────────────────────────────────────

function hist(
  weighed_on: string,
  company_name: string,
  received_kg: number,
  over: Partial<HistoricalDailyKgRow> = {},
): HistoricalDailyKgRow {
  return {
    id: 0,
    weighed_on,
    company_name,
    company_id: null,
    received_kg,
    received_records: 1,
    received_carts: 1,
    treated_kg: 0,
    treated_records: 0,
    source: 'F-PR-PT-13',
    created_at: '2026-09-14T00:00:00Z',
    ...over,
  }
}

function container(id: string, tare: number): Container {
  return {
    id,
    size_liters: 240,
    tare_weight_kg: tare,
    status: 'active',
    registered_at: '2026-01-01T00:00:00Z',
  }
}

function reception(
  id: string,
  arrived_at: string,
  gross: number,
  over: Partial<ContainerReception> = {},
): ContainerReception {
  return {
    id,
    container_id: 'c1',
    arrived_at,
    gross_weight_kg: gross,
    company_id: 'company-airkem',
    weighing_session_id: null,
    operator_id: 'op-1',
    photo_ids: [],
    observations: '',
    ...over,
  }
}

const COMPANIES: Company[] = [
  { id: 'company-airkem', client_id: 'client-1', name: 'Airkem', code_letter: 'A' },
]

// ─── Serie desde el sistema en vivo ──────────────────────────────────────────

describe('dailyKgFromLive', () => {
  it('agrupa por día y empresa, restando la tara', () => {
    const entries = dailyKgFromLive({
      companies: COMPANIES,
      containers: [container('c1', 10)],
      receptions: [
        reception('r1', '2026-09-07T12:00:00Z', 30),
        reception('r2', '2026-09-07T15:00:00Z', 25),
        reception('r3', '2026-09-08T09:00:00Z', 20),
      ],
    })

    expect(entries).toHaveLength(2)
    expect(entries[0]).toMatchObject({ date: '2026-09-07', kg: 35, records: 2, source: 'sistema' })
    expect(entries[1]).toMatchObject({ date: '2026-09-08', kg: 10, records: 1 })
  })

  it('ignora las recepciones anuladas', () => {
    const entries = dailyKgFromLive({
      companies: COMPANIES,
      containers: [container('c1', 10)],
      receptions: [
        reception('r1', '2026-09-07T12:00:00Z', 30),
        reception('r2', '2026-09-07T15:00:00Z', 25, { voided_at: '2026-09-07T16:00:00Z' }),
      ],
    })

    expect(entries).toHaveLength(1)
    expect(entries[0].kg).toBe(20)
    expect(entries[0].records).toBe(1)
  })

  it('descarta las recepciones anteriores al corte', () => {
    // El histórico ya cubre esos días. Si un backup viejo devuelve recepciones
    // pre-corte al store, sumarlas las contaría dos veces.
    const entries = dailyKgFromLive({
      companies: COMPANIES,
      containers: [container('c1', 10)],
      receptions: [
        reception('r1', '2026-09-04T12:00:00Z', 30), // prueba, antes del corte
        reception('r2', `${HISTORICAL_CUTOVER}T12:00:00Z`, 30), // primer día real
      ],
    })

    expect(entries).toHaveLength(1)
    expect(entries[0].date).toBe(HISTORICAL_CUTOVER)
    expect(entries[0].kg).toBe(20)
  })

  it('cae en "Sin especificar" cuando la recepción no trae empresa', () => {
    const entries = dailyKgFromLive({
      companies: COMPANIES,
      containers: [container('c1', 10)],
      receptions: [reception('r1', '2026-09-07T12:00:00Z', 30, { company_id: null })],
    })

    expect(entries[0].companyName).toBe('Sin especificar')
    expect(entries[0].companyId).toBeNull()
  })
})

// ─── Union de las dos fuentes ────────────────────────────────────────────────

describe('unifiedDailyKg', () => {
  it('concatena histórico y sistema ordenando por fecha', () => {
    const entries = unifiedDailyKg(
      [hist('2026-09-06', 'Airkem', 100), hist('2024-01-15', 'Sicarelle', 50)],
      {
        companies: COMPANIES,
        containers: [container('c1', 10)],
        receptions: [reception('r1', '2026-09-07T12:00:00Z', 30)],
      },
    )

    expect(entries.map((e) => e.date)).toEqual(['2024-01-15', '2026-09-06', '2026-09-07'])
    expect(entries.map((e) => e.source)).toEqual(['historico', 'historico', 'sistema'])
  })

  it('descarta las filas históricas que solo existen por un tratamiento', () => {
    // Una fila con received_records = 0 representa kilos TRATADOS ese día, no
    // recibidos: sumarla inflaría el recibido.
    const entries = unifiedDailyKg(
      [hist('2024-01-31', 'Airkem', 0, { received_records: 0, treated_kg: 75.2, treated_records: 4 })],
      { companies: COMPANIES, containers: [], receptions: [] },
    )

    expect(entries).toHaveLength(0)
  })
})

// ─── Rollups ─────────────────────────────────────────────────────────────────

describe('rollups', () => {
  const entries = unifiedDailyKg(
    [
      hist('2024-01-15', 'Airkem', 100, { received_records: 10 }),
      hist('2024-01-20', 'Sicarelle', 50, { received_records: 5 }),
      hist('2024-02-01', 'Airkem', 200, { received_records: 20 }),
      hist('2025-01-15', 'Airkem', 300, { received_records: 30 }),
    ],
    { companies: COMPANIES, containers: [], receptions: [] },
  )

  it('suma por mes y cuenta días distintos', () => {
    const byMonth = rollupByMonth(entries)
    expect(byMonth.get('2024-01')).toEqual({ kg: 150, records: 15, days: 2 })
    expect(byMonth.get('2024-02')).toEqual({ kg: 200, records: 20, days: 1 })
  })

  it('suma por año', () => {
    const byYear = rollupByYear(entries)
    expect(byYear.get('2024')?.kg).toBe(350)
    expect(byYear.get('2025')?.kg).toBe(300)
  })

  it('suma por empresa', () => {
    const byCompany = rollupByCompany(entries)
    expect(byCompany.get('Airkem')?.kg).toBe(600)
    expect(byCompany.get('Sicarelle')?.kg).toBe(50)
  })
})

// ─── Comparativo anual ───────────────────────────────────────────────────────

describe('yearlyMonthlySeries', () => {
  const entries = unifiedDailyKg(
    [
      hist('2024-01-15', 'Airkem', 100),
      hist('2024-03-15', 'Airkem', 300),
      hist('2025-01-15', 'Airkem', 500),
    ],
    { companies: COMPANIES, containers: [], receptions: [] },
  )

  it('deja en null los meses sin datos, no en cero', () => {
    // Un cero dibujaría una caída a piso en un año en curso; null corta la serie.
    const series = yearlyMonthlySeries(entries)
    const y2024 = series.find((s) => s.year === '2024')!

    expect(y2024.months[0]).toBe(100)
    expect(y2024.months[1]).toBeNull()
    expect(y2024.months[2]).toBe(300)
    expect(y2024.totalKg).toBe(400)
  })

  it('ordena los años de más viejo a más nuevo', () => {
    expect(yearlyMonthlySeries(entries).map((s) => s.year)).toEqual(['2024', '2025'])
  })

  it('produce un punto por mes con una clave por año', () => {
    const points = monthlyComparisonPoints(yearlyMonthlySeries(entries))

    expect(points).toHaveLength(12)
    expect(points[0]).toMatchObject({ month: 'Ene', monthIndex: 0, '2024': 100, '2025': 500 })
    expect(points[1]['2024']).toBeNull()
  })
})

// ─── Comparación contra el mismo período del año anterior ────────────────────

describe('comparePeriod', () => {
  const entries = unifiedDailyKg(
    [
      hist('2025-01-10', 'Airkem', 100, { received_records: 10 }),
      hist('2025-01-20', 'Airkem', 100, { received_records: 10 }),
      hist('2026-01-10', 'Airkem', 150, { received_records: 10 }),
      hist('2026-01-20', 'Airkem', 150, { received_records: 10 }),
    ],
    { companies: COMPANIES, containers: [], receptions: [] },
  )

  it('compara contra el mismo rango del año anterior', () => {
    const cmp = comparePeriod(entries, '2026-01-01', '2026-01-31')

    expect(cmp.current.kg).toBe(300)
    expect(cmp.previous?.kg).toBe(200)
    expect(cmp.deltaPct).toBe(50)
  })

  it('deja el delta en null cuando no hay período anterior', () => {
    const cmp = comparePeriod(entries, '2025-01-01', '2025-01-31')

    expect(cmp.previous).toBeNull()
    expect(cmp.deltaPct).toBeNull()
  })

  it('promedia por día con actividad, no por día calendario', () => {
    // 300 kg en 2 días con pesajes, aunque el rango tenga 31 días.
    const cmp = comparePeriod(entries, '2026-01-01', '2026-01-31')

    expect(cmp.current.days).toBe(2)
    expect(cmp.avgKgPerDay).toBe(150)
    expect(cmp.avgKgPerRecord).toBe(15)
  })
})

// ─── Mes histórico con la forma del gráfico de barras ────────────────────────

describe('historicalMonthlyKgByCompany', () => {
  const rows = [
    hist('2025-03-01', 'Airkem', 100, { company_id: 'company-airkem' }),
    hist('2025-03-02', 'Airkem', 50, { company_id: 'company-airkem' }),
    hist('2025-03-02', 'Sicarelle', 300),
    hist('2025-04-01', 'Airkem', 999, { company_id: 'company-airkem' }),
  ]

  it('agrupa solo el mes pedido y ordena por kilos descendente', () => {
    const out = historicalMonthlyKgByCompany(rows, '2025-03')

    expect(out.map((o) => o.company_name)).toEqual(['Sicarelle', 'Airkem'])
    expect(out[0].receivedKg).toBe(300)
    expect(out[1].receivedKg).toBe(150)
  })

  it('deja processedKg en cero: el tratado histórico no es comparable', () => {
    const out = historicalMonthlyKgByCompany(rows, '2025-03')
    expect(out.every((o) => o.processedKg === 0)).toBe(true)
  })

  it('inventa un id estable para las empresas que no existen en el sistema', () => {
    const out = historicalMonthlyKgByCompany(rows, '2025-03')
    const sicarelle = out.find((o) => o.company_name === 'Sicarelle')!

    expect(sicarelle.company_id).toBe('historico:Sicarelle')
  })
})

// ─── Mes del corte: hay que sumar las dos fuentes ────────────────────────────

describe('mergeMonthlyByCompany', () => {
  const historico = [
    {
      company_id: 'historico:Airkem',
      company_name: 'Airkem',
      client_id: '',
      receivedKg: 12983.7,
      processedKg: 0,
    },
  ]
  const vivo = [
    {
      company_id: 'company-airkem',
      company_name: 'Airkem',
      client_id: 'client-1',
      receivedKg: 19179.7,
      processedKg: 5000,
    },
  ]

  it('suma el mes partido entre las dos fuentes', () => {
    // El bug: la barra mensual mostraba solo 19,179.7 para septiembre 2026
    // mientras el comparativo anual mostraba el mes entero.
    const out = mergeMonthlyByCompany(historico, vivo)

    expect(out).toHaveLength(1)
    expect(out[0].receivedKg).toBe(32163.4)
    expect(out[0].processedKg).toBe(5000)
  })

  it('se queda con la empresa real del sistema y no con el id inventado', () => {
    const out = mergeMonthlyByCompany(historico, vivo)

    expect(out[0].company_id).toBe('company-airkem')
    expect(out[0].client_id).toBe('client-1')
  })

  it('conserva las empresas que solo aparecen en una de las dos fuentes', () => {
    const soloHistorico = [
      { company_id: 'historico:Sicarelle', company_name: 'Sicarelle', client_id: '', receivedKg: 300, processedKg: 0 },
    ]
    const out = mergeMonthlyByCompany([...historico, ...soloHistorico], vivo)

    expect(out.map((o) => o.company_name).sort()).toEqual(['Airkem', 'Sicarelle'])
  })

  it('ordena por kilos recibidos, de mayor a menor', () => {
    const grande = [
      { company_id: 'company-ion', company_name: 'ION', client_id: 'client-1', receivedKg: 99999, processedKg: 0 },
    ]
    const out = mergeMonthlyByCompany(historico, [...vivo, ...grande])

    expect(out[0].company_name).toBe('ION')
  })
})
