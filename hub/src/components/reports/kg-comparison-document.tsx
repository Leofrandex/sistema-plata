import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer'
import { APP_NAME } from '@hospiwaste/shared/lib/constants'
import { YEAR_COLORS } from '@hospiwaste/shared/lib/brand'
import type { KgComparisonReportData } from '@/lib/data/kg-comparison-report'
import { BRAND, PDF_FONT, PDF_RADIUS, registerPdfFonts } from './pdf-theme'
import { YearComparisonChartPdf } from './year-comparison-chart-pdf'

registerPdfFonts()

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

const NUM = new Intl.NumberFormat('es-PA', { maximumFractionDigits: 0 })
const NUM1 = new Intl.NumberFormat('es-PA', { maximumFractionDigits: 1 })
const DAY = new Intl.DateTimeFormat('es-PA', { day: 'numeric', month: 'long', year: 'numeric' })

function kg(value: number): string {
  return `${NUM.format(value)} kg`
}

function toneladas(value: number): string {
  return `${NUM1.format(value / 1000)} t`
}

function pct(value: number | null): string {
  if (value === null) return '—'
  return `${value > 0 ? '+' : ''}${NUM1.format(value)}%`
}

function mesLargo(month: string): string {
  return `${MESES[Number(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}`
}

/** 'YYYY-MM-DD' → '18 de septiembre de 2026'. Mediodía UTC para que el huso no
 *  corra la fecha un día hacia atrás. */
function diaLargo(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`)
  return Number.isNaN(d.getTime()) ? iso : DAY.format(d)
}

function deltaColor(value: number | null): string {
  if (value === null || value === 0) return BRAND.mutedForeground
  return value > 0 ? BRAND.positive : BRAND.negative
}

const styles = StyleSheet.create({
  page: {
    paddingTop: 30,
    paddingBottom: 40,
    paddingHorizontal: 34,
    fontSize: 9,
    fontFamily: PDF_FONT,
    fontWeight: 400,
    color: BRAND.primary,
  },

  // ── Encabezado ────────────────────────────────────────────────────────────
  // Una barra del acento de marca, del ancho de la caja de texto: es la misma
  // señal de identidad que el sidebar navy de la app, sin pintar medio papel.
  brandBar: {
    height: 3,
    backgroundColor: BRAND.accent,
    borderRadius: 2,
    marginBottom: 12,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  title: {
    fontSize: 17,
    fontFamily: PDF_FONT,
    fontWeight: 700,
    color: BRAND.primary,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 8.5,
    color: BRAND.mutedForeground,
    marginTop: 4,
  },
  wordmark: {
    fontSize: 9,
    fontWeight: 700,
    color: BRAND.accent,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },

  // ── Bloques ───────────────────────────────────────────────────────────────
  sectionTitle: {
    fontSize: 10.5,
    fontFamily: PDF_FONT,
    fontWeight: 700,
    color: BRAND.primary,
    marginTop: 18,
    marginBottom: 8,
  },
  card: {
    border: `0.75 solid ${BRAND.border}`,
    borderRadius: PDF_RADIUS,
    backgroundColor: BRAND.card,
  },

  // ── KPIs: una primaria ancha, tres secundarias ────────────────────────────
  kpiRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
  },
  kpiPrimary: {
    flex: 2,
    borderRadius: PDF_RADIUS,
    border: `0.75 solid ${BRAND.border}`,
    borderLeft: `2 solid ${BRAND.accent}`,
    paddingVertical: 10,
    paddingHorizontal: 11,
  },
  kpi: {
    flex: 1,
    borderRadius: PDF_RADIUS,
    border: `0.75 solid ${BRAND.border}`,
    paddingVertical: 10,
    paddingHorizontal: 9,
  },
  kpiLabel: {
    fontSize: 6.5,
    fontWeight: 600,
    color: BRAND.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  kpiValuePrimary: {
    fontSize: 22,
    fontWeight: 700,
    color: BRAND.primary,
    marginTop: 5,
  },
  kpiValue: {
    fontSize: 13,
    fontWeight: 700,
    color: BRAND.primary,
    marginTop: 5,
  },
  kpiHint: {
    fontSize: 7,
    color: BRAND.mutedForeground,
    marginTop: 3,
  },

  // ── Tablas ────────────────────────────────────────────────────────────────
  tr: {
    flexDirection: 'row',
    borderBottom: `0.5 solid ${BRAND.border}`,
  },
  trLast: {
    flexDirection: 'row',
  },
  th: {
    backgroundColor: BRAND.muted,
    fontWeight: 600,
    fontSize: 7,
    color: BRAND.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    paddingVertical: 6,
    paddingHorizontal: 7,
  },
  td: {
    fontSize: 8,
    paddingVertical: 5,
    paddingHorizontal: 7,
    color: BRAND.primary,
  },
  tdMuted: {
    color: BRAND.mutedForeground,
  },
  right: {
    textAlign: 'right',
  },

  // ── Leyenda del gráfico ───────────────────────────────────────────────────
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
    marginTop: 6,
    marginBottom: 2,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendSwatch: {
    width: 7,
    height: 7,
    borderRadius: 2,
  },
  legendText: {
    fontSize: 7.5,
    color: BRAND.mutedForeground,
  },

  note: {
    fontSize: 7.5,
    color: BRAND.mutedForeground,
    marginTop: 12,
    lineHeight: 1.45,
  },
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 34,
    right: 34,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 7,
    color: BRAND.mutedForeground,
    borderTop: `0.5 solid ${BRAND.border}`,
    paddingTop: 6,
  },
})

/** Anchos de columna, en porcentaje, para cada tabla. */
const COLS_MES = ['30%', '20%', '18%', '18%', '14%']
const COLS_EMPRESA = ['40%', '20%', '20%', '20%']
const COLS_ANO = ['25%', '25%', '25%', '25%']

interface Props {
  data: KgComparisonReportData
}

export function KgComparisonDocument({ data }: Props) {
  const { comparison, months, byCompany, years, from, to, generatedAt } = data
  const prev = comparison.previous

  return (
    <Document
      title={`${APP_NAME} — Comparativo de kilos ${from} a ${to}`}
      author={APP_NAME}
    >
      <Page size="A4" style={styles.page}>
        <View style={styles.brandBar} fixed />

        <View style={styles.headerRow}>
          <View>
            <Text style={styles.title}>Comparativo de kilos procesados</Text>
            <Text style={styles.subtitle}>
              Planta PTDP · {diaLargo(from)} al {diaLargo(to)}
            </Text>
          </View>
          <Text style={styles.wordmark}>{APP_NAME}</Text>
        </View>

        {/* ── Resumen del período ─────────────────────────────────────────── */}
        {/* El total del período es la cifra sobre la que se decide: va al doble
            de ancho y al doble de cuerpo, con el acento al costado. */}
        <View style={styles.kpiRow}>
          <View style={styles.kpiPrimary}>
            <Text style={styles.kpiLabel}>Total recibido en el período</Text>
            <Text style={styles.kpiValuePrimary}>{toneladas(comparison.current.kg)}</Text>
            <Text style={styles.kpiHint}>
              {kg(comparison.current.kg)} · {comparison.current.days} días con actividad ·{' '}
              {NUM.format(comparison.current.records)} pesajes
            </Text>
          </View>
          <View style={styles.kpi}>
            <Text style={styles.kpiLabel}>Vs. año anterior</Text>
            <Text style={[styles.kpiValue, { color: deltaColor(comparison.deltaPct) }]}>
              {pct(comparison.deltaPct)}
            </Text>
            <Text style={styles.kpiHint}>
              {prev ? `${toneladas(prev.kg)} en el mismo período` : 'sin período comparable'}
            </Text>
          </View>
          <View style={styles.kpi}>
            <Text style={styles.kpiLabel}>Promedio diario</Text>
            <Text style={styles.kpiValue}>
              {comparison.avgKgPerDay === null ? '—' : kg(comparison.avgKgPerDay)}
            </Text>
            <Text style={styles.kpiHint}>sobre días con pesajes</Text>
          </View>
          <View style={styles.kpi}>
            <Text style={styles.kpiLabel}>Promedio por pesaje</Text>
            <Text style={styles.kpiValue}>
              {comparison.avgKgPerRecord === null ? '—' : kg(comparison.avgKgPerRecord)}
            </Text>
            <Text style={styles.kpiHint}>media por tacho recibido</Text>
          </View>
        </View>

        {/* ── Comparativo interanual ──────────────────────────────────────── */}
        <Text style={styles.sectionTitle}>Kilos recibidos mes a mes, año contra año</Text>
        <View style={styles.legend}>
          {years.map((y, i) => (
            <View key={y.year} style={styles.legendItem}>
              <View
                style={[
                  styles.legendSwatch,
                  { backgroundColor: YEAR_COLORS[i % YEAR_COLORS.length] },
                ]}
              />
              <Text style={styles.legendText}>
                {y.year} · {toneladas(y.totalKg)}
              </Text>
            </View>
          ))}
        </View>
        {/* `wrap={false}`: un gráfico partido entre dos páginas no se lee. */}
        <View wrap={false}>
          <YearComparisonChartPdf series={years} />
        </View>

        {/* ── Mes a mes ───────────────────────────────────────────────────── */}
        <Text style={styles.sectionTitle}>Mes a mes, contra el mismo mes del año anterior</Text>
        <View style={styles.card}>
          <View style={styles.tr}>
            <Text style={[styles.th, { width: COLS_MES[0] }]}>Mes</Text>
            <Text style={[styles.th, styles.right, { width: COLS_MES[1] }]}>Kilos</Text>
            <Text style={[styles.th, styles.right, { width: COLS_MES[2] }]}>Año anterior</Text>
            <Text style={[styles.th, styles.right, { width: COLS_MES[3] }]}>Variación</Text>
            <Text style={[styles.th, styles.right, { width: COLS_MES[4] }]}>Pesajes</Text>
          </View>
          {months.map((m, i) => (
            <View key={m.month} style={i === months.length - 1 ? styles.trLast : styles.tr}>
              <Text style={[styles.td, { width: COLS_MES[0] }]}>{mesLargo(m.month)}</Text>
              <Text style={[styles.td, styles.right, { width: COLS_MES[1] }]}>{kg(m.kg)}</Text>
              <Text style={[styles.td, styles.tdMuted, styles.right, { width: COLS_MES[2] }]}>
                {m.previousKg === null ? '—' : kg(m.previousKg)}
              </Text>
              <Text
                style={[
                  styles.td,
                  styles.right,
                  { width: COLS_MES[3], color: deltaColor(m.deltaPct), fontWeight: 600 },
                ]}
              >
                {pct(m.deltaPct)}
              </Text>
              <Text style={[styles.td, styles.tdMuted, styles.right, { width: COLS_MES[4] }]}>
                {NUM.format(m.records)}
              </Text>
            </View>
          ))}
        </View>

        {/* ── Por empresa ─────────────────────────────────────────────────── */}
        <Text style={styles.sectionTitle}>Participación por empresa en el período</Text>
        <View style={styles.card}>
          <View style={styles.tr}>
            <Text style={[styles.th, { width: COLS_EMPRESA[0] }]}>Empresa</Text>
            <Text style={[styles.th, styles.right, { width: COLS_EMPRESA[1] }]}>Kilos</Text>
            <Text style={[styles.th, styles.right, { width: COLS_EMPRESA[2] }]}>Participación</Text>
            <Text style={[styles.th, styles.right, { width: COLS_EMPRESA[3] }]}>Pesajes</Text>
          </View>
          {byCompany.map((c, i) => (
            <View key={c.name} style={i === byCompany.length - 1 ? styles.trLast : styles.tr}>
              <Text style={[styles.td, { width: COLS_EMPRESA[0] }]}>{c.name}</Text>
              <Text style={[styles.td, styles.right, { width: COLS_EMPRESA[1] }]}>{kg(c.kg)}</Text>
              <Text
                style={[styles.td, styles.right, { width: COLS_EMPRESA[2], fontWeight: 600 }]}
              >
                {NUM1.format(c.sharePct)}%
              </Text>
              <Text style={[styles.td, styles.tdMuted, styles.right, { width: COLS_EMPRESA[3] }]}>
                {NUM.format(c.records)}
              </Text>
            </View>
          ))}
        </View>

        {/* ── Serie anual completa ────────────────────────────────────────── */}
        <Text style={styles.sectionTitle}>Total por año (histórico completo)</Text>
        <View style={styles.card}>
          <View style={styles.tr}>
            <Text style={[styles.th, { width: COLS_ANO[0] }]}>Año</Text>
            <Text style={[styles.th, styles.right, { width: COLS_ANO[1] }]}>Kilos</Text>
            <Text style={[styles.th, styles.right, { width: COLS_ANO[2] }]}>Toneladas</Text>
            <Text style={[styles.th, styles.right, { width: COLS_ANO[3] }]}>Pesajes</Text>
          </View>
          {years.map((y, i) => (
            <View key={y.year} style={i === years.length - 1 ? styles.trLast : styles.tr}>
              <Text style={[styles.td, { width: COLS_ANO[0], fontWeight: 600 }]}>{y.year}</Text>
              <Text style={[styles.td, styles.right, { width: COLS_ANO[1] }]}>{kg(y.totalKg)}</Text>
              <Text style={[styles.td, styles.right, { width: COLS_ANO[2], fontWeight: 600 }]}>
                {toneladas(y.totalKg)}
              </Text>
              <Text style={[styles.td, styles.tdMuted, styles.right, { width: COLS_ANO[3] }]}>
                {NUM.format(y.totalRecords)}
              </Text>
            </View>
          ))}
        </View>

        <Text style={styles.note}>
          Los kilos son peso neto recibido (bruto menos tara del tacho). Hasta el 6 de
          septiembre de 2026 provienen de las planillas de kilos diarios de planta; desde el 7
          de septiembre de 2026, de los pesajes registrados en {APP_NAME}. Las dos fuentes no se
          solapan. El período 2024 arranca el 15 de enero, primer día con registro. En el
          gráfico, un mes sin barra es un mes sin datos, no un mes en cero.
        </Text>

        <View style={styles.footer} fixed>
          <Text>
            {APP_NAME} · generado el {diaLargo(generatedAt.slice(0, 10))}
          </Text>
          <Text
            render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  )
}
