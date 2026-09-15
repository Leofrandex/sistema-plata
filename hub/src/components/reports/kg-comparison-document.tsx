import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer'
import { APP_NAME } from '@hospiwaste/shared/lib/constants'
import type { KgComparisonReportData } from '@/lib/data/kg-comparison-report'

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

const NUM = new Intl.NumberFormat('es-PA', { maximumFractionDigits: 0 })
const NUM1 = new Intl.NumberFormat('es-PA', { maximumFractionDigits: 1 })

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

const styles = StyleSheet.create({
  page: {
    paddingTop: 34,
    paddingBottom: 38,
    paddingHorizontal: 34,
    fontSize: 9,
    fontFamily: 'Helvetica',
    color: '#1e293b',
  },
  title: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    color: '#0f172a',
  },
  subtitle: {
    fontSize: 9,
    color: '#64748b',
    marginTop: 3,
  },
  rule: {
    borderBottom: '1 solid #cbd5e1',
    marginTop: 10,
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: '#0f172a',
    marginTop: 16,
    marginBottom: 7,
  },
  kpiRow: {
    flexDirection: 'row',
    gap: 8,
  },
  kpi: {
    flex: 1,
    border: '0.5 solid #cbd5e1',
    borderRadius: 3,
    paddingVertical: 7,
    paddingHorizontal: 8,
  },
  kpiLabel: {
    fontSize: 7,
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  kpiValue: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    color: '#0f172a',
    marginTop: 3,
  },
  kpiHint: {
    fontSize: 7,
    color: '#94a3b8',
    marginTop: 2,
  },
  table: {
    border: '0.5 solid #cbd5e1',
    borderRadius: 3,
  },
  tr: {
    flexDirection: 'row',
    borderBottom: '0.5 solid #e2e8f0',
  },
  trLast: {
    flexDirection: 'row',
  },
  th: {
    backgroundColor: '#f1f5f9',
    fontFamily: 'Helvetica-Bold',
    fontSize: 7.5,
    color: '#334155',
    paddingVertical: 5,
    paddingHorizontal: 6,
  },
  td: {
    fontSize: 8,
    paddingVertical: 4.5,
    paddingHorizontal: 6,
    color: '#0f172a',
  },
  right: {
    textAlign: 'right',
  },
  note: {
    fontSize: 7.5,
    color: '#64748b',
    marginTop: 7,
    lineHeight: 1.4,
  },
  footer: {
    position: 'absolute',
    bottom: 18,
    left: 34,
    right: 34,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 7,
    color: '#94a3b8',
    borderTop: '0.5 solid #e2e8f0',
    paddingTop: 5,
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
        <View>
          <Text style={styles.title}>Comparativo de kilos procesados</Text>
          <Text style={styles.subtitle}>
            Planta PTDP · período {from} al {to}
          </Text>
        </View>
        <View style={styles.rule} />

        {/* ── Resumen del período ─────────────────────────────────────────── */}
        <View style={styles.kpiRow}>
          <View style={styles.kpi}>
            <Text style={styles.kpiLabel}>Total recibido</Text>
            <Text style={styles.kpiValue}>{toneladas(comparison.current.kg)}</Text>
            <Text style={styles.kpiHint}>{kg(comparison.current.kg)}</Text>
          </View>
          <View style={styles.kpi}>
            <Text style={styles.kpiLabel}>Vs. año anterior</Text>
            <Text style={styles.kpiValue}>{pct(comparison.deltaPct)}</Text>
            <Text style={styles.kpiHint}>
              {prev ? `${toneladas(prev.kg)} en el mismo período` : 'sin período comparable'}
            </Text>
          </View>
          <View style={styles.kpi}>
            <Text style={styles.kpiLabel}>Promedio diario</Text>
            <Text style={styles.kpiValue}>
              {comparison.avgKgPerDay === null ? '—' : kg(comparison.avgKgPerDay)}
            </Text>
            <Text style={styles.kpiHint}>{comparison.current.days} días con actividad</Text>
          </View>
          <View style={styles.kpi}>
            <Text style={styles.kpiLabel}>Promedio por pesaje</Text>
            <Text style={styles.kpiValue}>
              {comparison.avgKgPerRecord === null ? '—' : kg(comparison.avgKgPerRecord)}
            </Text>
            <Text style={styles.kpiHint}>
              {NUM.format(comparison.current.records)} pesajes
            </Text>
          </View>
        </View>

        {/* ── Mes a mes ───────────────────────────────────────────────────── */}
        <Text style={styles.sectionTitle}>Mes a mes, contra el mismo mes del año anterior</Text>
        <View style={styles.table}>
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
              <Text style={[styles.td, styles.right, { width: COLS_MES[2] }]}>
                {m.previousKg === null ? '—' : kg(m.previousKg)}
              </Text>
              <Text style={[styles.td, styles.right, { width: COLS_MES[3] }]}>
                {pct(m.deltaPct)}
              </Text>
              <Text style={[styles.td, styles.right, { width: COLS_MES[4] }]}>
                {NUM.format(m.records)}
              </Text>
            </View>
          ))}
        </View>

        {/* ── Por empresa ─────────────────────────────────────────────────── */}
        <Text style={styles.sectionTitle}>Participación por empresa en el período</Text>
        <View style={styles.table}>
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
              <Text style={[styles.td, styles.right, { width: COLS_EMPRESA[2] }]}>
                {NUM1.format(c.sharePct)}%
              </Text>
              <Text style={[styles.td, styles.right, { width: COLS_EMPRESA[3] }]}>
                {NUM.format(c.records)}
              </Text>
            </View>
          ))}
        </View>

        {/* ── Serie anual completa ────────────────────────────────────────── */}
        <Text style={styles.sectionTitle}>Total por año (histórico completo)</Text>
        <View style={styles.table}>
          <View style={styles.tr}>
            <Text style={[styles.th, { width: COLS_ANO[0] }]}>Año</Text>
            <Text style={[styles.th, styles.right, { width: COLS_ANO[1] }]}>Kilos</Text>
            <Text style={[styles.th, styles.right, { width: COLS_ANO[2] }]}>Toneladas</Text>
            <Text style={[styles.th, styles.right, { width: COLS_ANO[3] }]}>Pesajes</Text>
          </View>
          {years.map((y, i) => (
            <View key={y.year} style={i === years.length - 1 ? styles.trLast : styles.tr}>
              <Text style={[styles.td, { width: COLS_ANO[0] }]}>{y.year}</Text>
              <Text style={[styles.td, styles.right, { width: COLS_ANO[1] }]}>{kg(y.totalKg)}</Text>
              <Text style={[styles.td, styles.right, { width: COLS_ANO[2] }]}>
                {toneladas(y.totalKg)}
              </Text>
              <Text style={[styles.td, styles.right, { width: COLS_ANO[3] }]}>
                {NUM.format(y.totalRecords)}
              </Text>
            </View>
          ))}
        </View>

        <Text style={styles.note}>
          Los kilos son peso neto recibido (bruto menos tara del tacho). Hasta el 6 de
          septiembre de 2026 provienen de las planillas de kilos diarios de planta; desde el 7
          de septiembre de 2026, de los pesajes registrados en {APP_NAME}. Las dos fuentes no se
          solapan. El período 2024 arranca el 15 de enero, primer día con registro.
        </Text>

        <View style={styles.footer} fixed>
          <Text>
            {APP_NAME} · generado el {generatedAt.slice(0, 10)}
          </Text>
          <Text
            render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  )
}
