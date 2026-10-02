import {
  Document, Page, Text, View, Image, StyleSheet,
} from '@react-pdf/renderer'
import { APP_NAME } from '@hospiwaste/shared/lib/constants'
import type { PhotographicReportData } from '@/lib/data/reports'
import { paginateDay, type LayoutCuadro, type LayoutDay, type ReportLayout } from '@/lib/data/report-layout'

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
  },
  photoCell: {
    width: '25%',
    padding: 1,
  },
  // Alto fijo casi cuadrado + objectFit 'contain': la foto entra completa sea
  // vertical u horizontal, con el sello de fecha/hora de la esquina inferior
  // derecha visible. Con 'cover' en un recuadro 4:3 se cortaban las verticales
  // (las del tacho). 96 pt es lo máximo que deja 2 filas de cuadros por hoja.
  photoBox: {
    height: 96,
    width: '100%',
    backgroundColor: '#f8fafc',
    overflow: 'hidden',
  },
  photo: {
    width: '100%',
    height: '100%',
    objectFit: 'contain',
  },
  // Recuadro sin foto: mismo alto que uno con foto, en blanco.
  emptyBox: {
    height: 96,
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
  missing: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    border: '0.5 dashed #cbd5e1',
  },
  missingText: { fontSize: 6, color: '#94a3b8', textAlign: 'center' },
})

/** url original → data URL reducido; null si la foto no se pudo descargar. */
export type ReportImages = Map<string, string | null>

/**
 * Dibuja una foto ya reducida. Si falta (descarga fallida), muestra un aviso en
 * vez de dejar el recuadro en blanco, así el hueco no pasa desapercibido.
 */
function ReportPhoto({ url, images }: { url: string; images: ReportImages }) {
  const src = images.get(url)
  if (!src) {
    return (
      <View style={styles.missing}>
        <Text style={styles.missingText}>Foto no disponible</Text>
      </View>
    )
  }
  // eslint-disable-next-line jsx-a11y/alt-text
  return <Image src={src} style={styles.photo} />
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
        <Text style={styles.metaValue}>4E</Text>
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

function CuadroView({ cuadro, images }: { cuadro: LayoutCuadro; images: ReportImages }) {
  return (
    <View style={styles.cuadro} wrap={false}>
      <Text style={styles.cuadroHeader}>{cuadro.label}</Text>
      <View style={styles.photoGrid}>
        {cuadro.slots.map((photo, i) => (
          <View key={i} style={styles.photoCell}>
            {photo ? (
              <View style={styles.photoBox}>
                <ReportPhoto url={photo.url} images={images} />
              </View>
            ) : (
              <View style={styles.emptyBox} />
            )}
          </View>
        ))}
      </View>
      <View style={styles.comentario}>
        <Text style={styles.comentarioLabel}>Comentario:</Text>
        <Text style={styles.comentarioText}>{cuadro.comment}</Text>
      </View>
    </View>
  )
}

function DayPages({ day, companyName, images }: { day: LayoutDay; companyName: string; images: ReportImages }) {
  return (
    <>
      {paginateDay(day).map((pageCuadros, idx) => (
        <Page key={`${day.date}-${idx}`} size="A4" orientation="landscape" style={styles.page}>
          <PageHeader />
          <MetaBar companyName={companyName} fecha={day.date} />
          <View style={styles.cuadrosWrap}>
            {pageCuadros.map((c) => (
              <CuadroView key={c.id} cuadro={c} images={images} />
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
  /** Empresa y rango (encabezados y nota de reporte vacío). */
  data: PhotographicReportData
  /** Qué foto va en cada recuadro: la automática o la editada. */
  layout: ReportLayout
  /** Fotos ya descargadas y reducidas (ver `prepareReportImages`). */
  images: ReportImages
}

export function PhotographicReportDocument({ data, layout, images }: Props) {
  const { company } = data
  const empty = layout.days.every((d) => d.cuadros.length === 0)
  return (
    <Document title={`${APP_NAME} — Registro Fotográfico — ${company.name}`}>
      {layout.days.map((day) => (
        <DayPages key={day.date} day={day} companyName={company.name} images={images} />
      ))}
      {empty && (
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
