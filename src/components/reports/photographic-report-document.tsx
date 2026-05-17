import {
  Document, Page, Text, View, Image, StyleSheet,
} from '@react-pdf/renderer'
import { APP_NAME } from '@/lib/constants'
import type { PhotographicReportData, ReportPhotoEntry } from '@/lib/data/reports'

const PHOTOS_PER_PAGE = 6 // 2 columnas × 3 filas

const styles = StyleSheet.create({
  page: {
    padding: 28,
    fontSize: 9,
    fontFamily: 'Helvetica',
    color: '#1e293b',
  },
  // Portada
  coverPage: {
    padding: 48,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  coverTitle: {
    fontSize: 26,
    fontFamily: 'Helvetica-Bold',
    color: '#0f172a',
    textAlign: 'center',
  },
  coverSubtitle: {
    fontSize: 14,
    color: '#475569',
    textAlign: 'center',
  },
  coverMetaBox: {
    marginTop: 32,
    padding: 16,
    border: '1 solid #e2e8f0',
    borderRadius: 6,
    width: '70%',
    gap: 6,
  },
  coverMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  coverMetaLabel: { color: '#64748b' },
  coverMetaValue: { color: '#0f172a', fontFamily: 'Helvetica-Bold' },
  // Header de cada página de contenido
  pageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingBottom: 8,
    borderBottom: '1 solid #cbd5e1',
    marginBottom: 12,
  },
  companyBadge: {
    width: 70,
    height: 40,
    borderRadius: 4,
    backgroundColor: '#0f172a',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  },
  companyBadgeLetter: {
    color: '#ffffff',
    fontSize: 22,
    fontFamily: 'Helvetica-Bold',
  },
  companyBadgeName: {
    color: '#cbd5e1',
    fontSize: 7,
    letterSpacing: 1,
  },
  pageTitleBlock: {
    flex: 1,
    alignItems: 'center',
  },
  pageTitle: {
    fontSize: 13,
    fontFamily: 'Helvetica-Bold',
    color: '#0f172a',
    letterSpacing: 1.2,
  },
  pageSubtitle: {
    fontSize: 8,
    color: '#64748b',
    marginTop: 2,
  },
  metaTable: {
    width: 130,
    border: '0.5 solid #cbd5e1',
  },
  metaTableRow: {
    flexDirection: 'row',
    borderBottom: '0.5 solid #cbd5e1',
  },
  metaTableRowLast: { flexDirection: 'row' },
  metaTableCellLabel: {
    width: 50,
    padding: 3,
    backgroundColor: '#f1f5f9',
    fontSize: 7,
    color: '#475569',
    fontFamily: 'Helvetica-Bold',
  },
  metaTableCellValue: {
    flex: 1,
    padding: 3,
    fontSize: 7,
    color: '#0f172a',
  },
  // Grid de fotos
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  photoCell: {
    width: '48.5%',
    border: '0.5 solid #cbd5e1',
    borderRadius: 4,
    padding: 4,
    marginBottom: 8,
  },
  photoBox: {
    aspectRatio: 4 / 3,
    width: '100%',
    borderRadius: 2,
    backgroundColor: '#f1f5f9',
    overflow: 'hidden',
  },
  photo: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  photoCommentBox: {
    marginTop: 4,
    paddingTop: 3,
    borderTop: '0.5 solid #e2e8f0',
  },
  photoCommentLabel: {
    fontSize: 7,
    color: '#64748b',
    fontFamily: 'Helvetica-Bold',
  },
  photoCommentText: {
    fontSize: 7,
    color: '#1e293b',
    marginTop: 1,
  },
  pageNumber: {
    position: 'absolute',
    bottom: 16,
    right: 28,
    fontSize: 7,
    color: '#94a3b8',
  },
  emptyStage: {
    padding: 32,
    border: '1 dashed #cbd5e1',
    borderRadius: 6,
    alignItems: 'center',
  },
  emptyStageText: {
    color: '#64748b',
    fontSize: 10,
  },
})

interface PageHeaderProps {
  companyLetter: string
  companyName: string
  edificio: string
  ubicacion: string
  fecha: string
}

function PageHeader({ companyLetter, companyName, edificio, ubicacion, fecha }: PageHeaderProps) {
  return (
    <View style={styles.pageHeader} fixed>
      <View style={styles.companyBadge}>
        <Text style={styles.companyBadgeLetter}>{companyLetter}</Text>
        <Text style={styles.companyBadgeName}>{companyName.toUpperCase()}</Text>
      </View>
      <View style={styles.pageTitleBlock}>
        <Text style={styles.pageTitle}>REGISTRO FOTOGRÁFICO</Text>
        <Text style={styles.pageSubtitle}>{companyName}</Text>
      </View>
      <View style={styles.metaTable}>
        <View style={styles.metaTableRow}>
          <Text style={styles.metaTableCellLabel}>Edificio</Text>
          <Text style={styles.metaTableCellValue}>{edificio}</Text>
        </View>
        <View style={styles.metaTableRow}>
          <Text style={styles.metaTableCellLabel}>Ubicación</Text>
          <Text style={styles.metaTableCellValue}>{ubicacion}</Text>
        </View>
        <View style={styles.metaTableRowLast}>
          <Text style={styles.metaTableCellLabel}>Fecha</Text>
          <Text style={styles.metaTableCellValue}>{fecha}</Text>
        </View>
      </View>
    </View>
  )
}

function PhotoCell({ entry }: { entry: ReportPhotoEntry }) {
  return (
    <View style={styles.photoCell} wrap={false}>
      <View style={styles.photoBox}>
        {/* eslint-disable-next-line jsx-a11y/alt-text */}
        <Image src={entry.photo.url} style={styles.photo} />
      </View>
      <View style={styles.photoCommentBox}>
        <Text style={styles.photoCommentLabel}>Comentario:</Text>
        <Text style={styles.photoCommentText}>{entry.comment}</Text>
      </View>
    </View>
  )
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size))
  }
  return out
}

interface StagePagesProps {
  ubicacion: string
  photos: ReportPhotoEntry[]
  companyLetter: string
  companyName: string
  fechaText: string
}

function StagePages({ ubicacion, photos, companyLetter, companyName, fechaText }: StagePagesProps) {
  if (photos.length === 0) return null
  const pages = chunk(photos, PHOTOS_PER_PAGE)
  return (
    <>
      {pages.map((pagePhotos, pageIdx) => (
        <Page key={`${ubicacion}-${pageIdx}`} size="A4" style={styles.page} orientation="landscape">
          <PageHeader
            companyLetter={companyLetter}
            companyName={companyName}
            edificio="—"
            ubicacion={ubicacion}
            fecha={fechaText}
          />
          <View style={styles.photoGrid}>
            {pagePhotos.map((entry) => (
              <PhotoCell key={entry.photo.id} entry={entry} />
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
  const { company, client, weekStart, weekEnd, generatedAt, byStage, meta } = data
  const generatedAtFormatted = new Date(generatedAt).toLocaleString('es-PA')
  const fechaText = `${weekStart} a ${weekEnd}`

  return (
    <Document title={`${APP_NAME} — Registro Fotográfico — ${company.name}`}>
      {/* Portada */}
      <Page size="A4" style={[styles.page, styles.coverPage]}>
        <Text style={{ fontSize: 11, color: '#475569', letterSpacing: 2 }}>{APP_NAME.toUpperCase()}</Text>
        <Text style={styles.coverTitle}>REGISTRO FOTOGRÁFICO</Text>
        <Text style={styles.coverSubtitle}>{company.name}</Text>
        <Text style={[styles.coverSubtitle, { fontSize: 11 }]}>
          Cliente: {client.name}
        </Text>
        <Text style={[styles.coverSubtitle, { fontSize: 11 }]}>
          Semana del {weekStart} al {weekEnd}
        </Text>

        <View style={styles.coverMetaBox}>
          <View style={styles.coverMetaRow}>
            <Text style={styles.coverMetaLabel}>Recorridos registrados</Text>
            <Text style={styles.coverMetaValue}>{meta.routeEventCount}</Text>
          </View>
          <View style={styles.coverMetaRow}>
            <Text style={styles.coverMetaLabel}>Envases pesados</Text>
            <Text style={styles.coverMetaValue}>{meta.weighingReceptionCount}</Text>
          </View>
          <View style={styles.coverMetaRow}>
            <Text style={styles.coverMetaLabel}>Total de fotos</Text>
            <Text style={styles.coverMetaValue}>{meta.totalPhotos}</Text>
          </View>
          <View style={styles.coverMetaRow}>
            <Text style={styles.coverMetaLabel}>Generado</Text>
            <Text style={styles.coverMetaValue}>{generatedAtFormatted}</Text>
          </View>
        </View>
      </Page>

      <StagePages
        ubicacion="Recorridos"
        photos={byStage.route}
        companyLetter={company.code_letter}
        companyName={company.name}
        fechaText={fechaText}
      />

      <StagePages
        ubicacion="Pesajes"
        photos={byStage.weighing}
        companyLetter={company.code_letter}
        companyName={company.name}
        fechaText={fechaText}
      />

      {meta.totalPhotos === 0 && (
        <Page size="A4" style={styles.page}>
          <View style={styles.emptyStage}>
            <Text style={styles.emptyStageText}>
              No hay registros fotográficos para {company.name} en el rango {weekStart} a {weekEnd}.
            </Text>
          </View>
        </Page>
      )}
    </Document>
  )
}
