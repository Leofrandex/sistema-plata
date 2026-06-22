import {
  Document, Page, Text, View, Image, StyleSheet,
} from '@react-pdf/renderer'
import { APP_NAME } from '@/lib/constants'
import { chunk } from '@/lib/data/reports'
import type { PhotographicReportData, ReportDay, ReportPhotoEntry, WeighingPair } from '@/lib/data/reports'

const PHOTOS_PER_CUADRO = 8 // 4 columnas × 2 filas (recorrido)
const PAIRS_PER_CUADRO = 4  // 4 pesajes por bloque (peso arriba / tacho abajo)
const CUADROS_PER_PAGE = 4 // 2 × 2

const styles = StyleSheet.create({
  page: {
    paddingTop: 18,
    paddingBottom: 28,
    paddingHorizontal: 20,
    fontSize: 8,
    fontFamily: 'Helvetica',
    color: '#1e293b',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  headerSide: {
    width: 110,
    justifyContent: 'center',
  },
  logoRiga: {
    width: 92,
    height: 33, // 1200×430 → ratio 2.79
    objectFit: 'contain',
  },
  logoCpch: {
    width: 38,
    height: 38,
    objectFit: 'contain',
    alignSelf: 'flex-end',
  },
  titleWrap: {
    flexGrow: 1,
    alignItems: 'center',
  },
  title: {
    textAlign: 'center',
    fontSize: 13,
    fontFamily: 'Helvetica-Bold',
    color: '#0f172a',
    letterSpacing: 1.2,
  },
  metaBar: {
    flexDirection: 'row',
    border: '0.5 solid #94a3b8',
    marginBottom: 8,
  },
  metaCell: {
    flexDirection: 'row',
    borderRight: '0.5 solid #94a3b8',
  },
  metaLabel: {
    paddingVertical: 3,
    paddingHorizontal: 5,
    backgroundColor: '#e2e8f0',
    fontFamily: 'Helvetica-Bold',
    fontSize: 7,
    color: '#334155',
  },
  metaValue: {
    paddingVertical: 3,
    paddingHorizontal: 6,
    fontSize: 7,
    color: '#0f172a',
    minWidth: 60,
  },
  cuadrosWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  cuadro: {
    width: '48.8%',
    border: '0.5 solid #94a3b8',
    borderRadius: 2,
  },
  cuadroHeader: {
    backgroundColor: '#f1f5f9',
    paddingVertical: 2,
    paddingHorizontal: 4,
    borderBottom: '0.5 solid #94a3b8',
    fontFamily: 'Helvetica-Bold',
    fontSize: 7,
    color: '#334155',
    textAlign: 'center',
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 2,
    minHeight: 150,
  },
  photoCell: {
    width: '25%',
    padding: 1,
  },
  photoBox: {
    aspectRatio: 4 / 3,
    width: '100%',
    backgroundColor: '#f8fafc',
    overflow: 'hidden',
  },
  photo: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  comentario: {
    flexDirection: 'row',
    borderTop: '0.5 solid #94a3b8',
    paddingVertical: 3,
    paddingHorizontal: 4,
  },
  comentarioLabel: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 7,
    color: '#334155',
  },
  comentarioText: {
    fontSize: 7,
    color: '#0f172a',
    marginLeft: 3,
  },
  pageNumber: {
    position: 'absolute',
    bottom: 12,
    right: 20,
    fontSize: 7,
    color: '#94a3b8',
  },
  empty: {
    margin: 32,
    padding: 32,
    border: '1 dashed #cbd5e1',
    borderRadius: 6,
    alignItems: 'center',
  },
  emptyText: { color: '#64748b', fontSize: 10 },
})

interface Cuadro {
  label: string
  stage: 'route' | 'weighing'
  photos?: ReportPhotoEntry[]
  pairs?: WeighingPair[]
}

/** Convierte los grupos de un día en cuadros (recorrido: 8 fotos; pesaje: 4 pares). */
function buildCuadros(day: ReportDay): Cuadro[] {
  const cuadros: Cuadro[] = []
  for (const group of day.groups) {
    if (group.stage === 'weighing' && group.pairs) {
      const parts = chunk(group.pairs, PAIRS_PER_CUADRO)
      parts.forEach((pairs, i) => {
        cuadros.push({ label: i === 0 ? group.label : `${group.label} (cont.)`, stage: 'weighing', pairs })
      })
    } else {
      const parts = chunk(group.photos, PHOTOS_PER_CUADRO)
      parts.forEach((photos, i) => {
        cuadros.push({ label: i === 0 ? group.label : `${group.label} (cont.)`, stage: 'route', photos })
      })
    }
  }
  return cuadros
}

/** Banda superior: logo RIGA (contratista) · título · logo CPCH (Ciudad de la Salud). */
function PageHeader() {
  return (
    <View style={styles.header} fixed>
      <View style={styles.headerSide}>
        {/* eslint-disable-next-line jsx-a11y/alt-text */}
        <Image src="/logo-riga.png" style={styles.logoRiga} />
      </View>
      <View style={styles.titleWrap}>
        <Text style={styles.title}>REGISTRO FOTOGRÁFICO</Text>
      </View>
      <View style={styles.headerSide}>
        {/* eslint-disable-next-line jsx-a11y/alt-text */}
        <Image src="/logo-cpch.jpg" style={styles.logoCpch} />
      </View>
    </View>
  )
}

function MetaBar({ companyName, fecha }: { companyName: string; fecha: string }) {
  return (
    <View style={styles.metaBar} fixed>
      <View style={styles.metaCell}>
        <Text style={styles.metaLabel}>Edificio</Text>
        <Text style={styles.metaValue}>—</Text>
      </View>
      <View style={styles.metaCell}>
        <Text style={styles.metaLabel}>Ubicación</Text>
        <Text style={styles.metaValue}>PTDP</Text>
      </View>
      <View style={styles.metaCell}>
        <Text style={styles.metaLabel}>Empresa</Text>
        <Text style={styles.metaValue}>{companyName}</Text>
      </View>
      <View style={[styles.metaCell, { borderRight: 'none' }]}>
        <Text style={styles.metaLabel}>Fecha</Text>
        <Text style={styles.metaValue}>{fecha}</Text>
      </View>
    </View>
  )
}

function CuadroView({ cuadro }: { cuadro: Cuadro }) {
  return (
    <View style={styles.cuadro} wrap={false}>
      <Text style={styles.cuadroHeader}>{cuadro.label}</Text>
      <View style={styles.photoGrid}>
        {cuadro.stage === 'weighing'
          ? (cuadro.pairs ?? []).map((pair, i) => (
              <View key={`${pair.container_id}-${i}`} style={styles.photoCell}>
                <View style={[styles.photoBox, { marginBottom: 2 }]}>
                  {/* eslint-disable-next-line jsx-a11y/alt-text */}
                  {pair.scale && <Image src={pair.scale.url} style={styles.photo} />}
                </View>
                <View style={styles.photoBox}>
                  {/* eslint-disable-next-line jsx-a11y/alt-text */}
                  {pair.tacho && <Image src={pair.tacho.url} style={styles.photo} />}
                </View>
              </View>
            ))
          : (cuadro.photos ?? []).map((entry) => (
              <View key={entry.photo.id} style={styles.photoCell}>
                <View style={styles.photoBox}>
                  {/* eslint-disable-next-line jsx-a11y/alt-text */}
                  <Image src={entry.photo.url} style={styles.photo} />
                </View>
              </View>
            ))}
      </View>
      <View style={styles.comentario}>
        <Text style={styles.comentarioLabel}>Comentario:</Text>
        <Text style={styles.comentarioText}>{cuadro.label}</Text>
      </View>
    </View>
  )
}

function DayPages({ day, companyName }: { day: ReportDay; companyName: string }) {
  const cuadros = buildCuadros(day)
  const pages = chunk(cuadros, CUADROS_PER_PAGE)
  return (
    <>
      {pages.map((pageCuadros, idx) => (
        <Page key={`${day.date}-${idx}`} size="A4" orientation="landscape" style={styles.page}>
          <PageHeader />
          <MetaBar companyName={companyName} fecha={day.date} />
          <View style={styles.cuadrosWrap}>
            {pageCuadros.map((c, i) => (
              <CuadroView key={`${day.date}-${idx}-${i}`} cuadro={c} />
            ))}
          </View>
          <Text
            style={styles.pageNumber}
            render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`}
            fixed
          />
        </Page>
      ))}
    </>
  )
}

interface Props {
  data: PhotographicReportData
}

export function PhotographicReportDocument({ data }: Props) {
  const { company, days, meta } = data
  return (
    <Document title={`${APP_NAME} — Registro Fotográfico — ${company.name}`}>
      {days.map((day) => (
        <DayPages key={day.date} day={day} companyName={company.name} />
      ))}
      {meta.totalPhotos === 0 && (
        <Page size="A4" orientation="landscape" style={styles.page}>
          <PageHeader />
          <View style={styles.empty}>
            <Text style={styles.emptyText}>
              No hay registros fotográficos para {company.name} en el rango {data.rangeStart} a {data.rangeEnd}.
            </Text>
          </View>
        </Page>
      )}
    </Document>
  )
}
