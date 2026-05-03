import {
  Document, Page, Text, View, Image, StyleSheet,
} from '@react-pdf/renderer'
import type { Batch, Client, Container, ContainerReception, Photo } from '@/lib/types'

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 10, fontFamily: 'Helvetica', color: '#1e293b' },
  coverPage: { padding: 48, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 },
  coverTitle: { fontSize: 22, fontFamily: 'Helvetica-Bold', textAlign: 'center', color: '#0f172a' },
  coverSubtitle: { fontSize: 13, textAlign: 'center', color: '#475569' },
  coverMeta: { fontSize: 11, textAlign: 'center', color: '#64748b', marginTop: 4 },
  section: { marginBottom: 12 },
  sectionTitle: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4, borderBottom: '0.5 solid #e2e8f0', paddingBottom: 3 },
  row: { flexDirection: 'row', gap: 16, marginBottom: 6 },
  labelValue: { flex: 1 },
  label: { fontSize: 8, color: '#94a3b8', marginBottom: 1 },
  value: { fontSize: 10, color: '#0f172a', fontFamily: 'Helvetica-Bold' },
  photoRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 4 },
  photoBox: { width: '48%' },
  photo: { width: '100%', aspectRatio: '4/3', borderRadius: 4, objectFit: 'cover' },
  photoLabel: { fontSize: 7, color: '#94a3b8', marginTop: 2, textAlign: 'center' },
  divider: { borderBottom: '0.5 solid #e2e8f0', marginVertical: 12 },
  summaryTable: { borderTop: '0.5 solid #e2e8f0', marginTop: 8 },
  summaryRow: { flexDirection: 'row', borderBottom: '0.5 solid #f1f5f9', paddingVertical: 4 },
  summaryHeader: { backgroundColor: '#f8fafc' },
  summaryCell: { flex: 1, fontSize: 9, paddingHorizontal: 4, color: '#334155' },
  summaryCellBold: { flex: 1, fontSize: 9, fontFamily: 'Helvetica-Bold', paddingHorizontal: 4, color: '#0f172a' },
  pageNumber: { position: 'absolute', bottom: 20, right: 32, fontSize: 8, color: '#94a3b8' },
})

const WASTE_LABELS: Record<string, string> = {
  infectious: 'Peligroso Infeccioso',
  anatomopathological: 'Anatomopatológico',
  cytotoxic: 'Citotóxico',
  liquid: 'Líquidos',
  morgue: 'Morgue',
}

interface ContainerReportData {
  container: Container
  reception: ContainerReception | null
  exchangePhotos: Photo[]
  weighingPhotos: Photo[]
  storagePhotos: Photo[]
}

interface Props {
  batch: Batch
  client: Client
  containerData: ContainerReportData[]
}

export function BatchReportDocument({ batch, client, containerData }: Props) {
  const totalNetWeight = containerData.reduce((sum, { container, reception }) => {
    if (!reception) return sum
    return sum + Math.round((reception.gross_weight_kg - container.tare_weight_kg) * 100) / 100
  }, 0)

  return (
    <Document title={`Reporte Hospimed — ${client.name} — ${batch.date}`}>
      <Page size="A4" style={[styles.page, styles.coverPage]}>
        <Text style={styles.coverTitle}>HOSPIMED</Text>
        <Text style={styles.coverTitle}>Informe de Procesamiento</Text>
        <Text style={[styles.coverSubtitle, { marginTop: 16 }]}>{client.name}</Text>
        <Text style={styles.coverMeta}>Fecha: {batch.date}</Text>
        <Text style={styles.coverMeta}>Total de envases: {containerData.length}</Text>
        <Text style={styles.coverMeta}>Peso neto total: {totalNetWeight.toFixed(1)} kg</Text>
        <Text style={styles.coverMeta}>Generado: {new Date().toLocaleString('es-PA')}</Text>
      </Page>

      {containerData.map(({ container, reception, exchangePhotos, weighingPhotos, storagePhotos }) => {
        const netWeight = reception
          ? Math.round((reception.gross_weight_kg - container.tare_weight_kg) * 100) / 100
          : null

        return (
          <Page key={container.id} size="A4" style={styles.page}>
            <View style={styles.section}>
              <Text style={{ fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#0f172a' }}>Envase {container.id}</Text>
              <Text style={{ fontSize: 9, color: '#64748b', marginTop: 2 }}>{client.name} · {batch.date}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Datos del envase</Text>
              <View style={styles.row}>
                <View style={styles.labelValue}><Text style={styles.label}>Número</Text><Text style={styles.value}>{container.id}</Text></View>
                <View style={styles.labelValue}><Text style={styles.label}>Tipo de desecho</Text><Text style={styles.value}>{WASTE_LABELS[container.waste_type]}</Text></View>
                <View style={styles.labelValue}><Text style={styles.label}>Tamaño</Text><Text style={styles.value}>{container.size_liters} L</Text></View>
              </View>
              <View style={styles.row}>
                <View style={styles.labelValue}><Text style={styles.label}>Tara</Text><Text style={styles.value}>{container.tare_weight_kg} kg</Text></View>
                <View style={styles.labelValue}><Text style={styles.label}>Peso bruto</Text><Text style={styles.value}>{reception ? `${reception.gross_weight_kg} kg` : '—'}</Text></View>
                <View style={styles.labelValue}><Text style={styles.label}>Peso neto</Text><Text style={[styles.value, { color: '#0284c7' }]}>{netWeight !== null ? `${netWeight} kg` : '—'}</Text></View>
              </View>
              {reception && (
                <View style={styles.row}>
                  <View style={styles.labelValue}>
                    <Text style={styles.label}>Fecha / hora de pesaje</Text>
                    <Text style={styles.value}>{new Date(reception.arrived_at).toLocaleString('es-PA')}</Text>
                  </View>
                </View>
              )}
            </View>
            {exchangePhotos.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Intercambio en punto de encuentro</Text>
                <View style={styles.photoRow}>
                  {exchangePhotos.map((photo) => (
                    <View key={photo.id} style={styles.photoBox}>
                      <Image src={photo.url} style={styles.photo} />
                      <Text style={styles.photoLabel}>{photo.label}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
            {weighingPhotos.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Pesaje en planta</Text>
                <View style={styles.photoRow}>
                  {weighingPhotos.map((photo) => (
                    <View key={photo.id} style={styles.photoBox}>
                      <Image src={photo.url} style={styles.photo} />
                      <Text style={styles.photoLabel}>{photo.label}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
            {storagePhotos.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Cámara fría</Text>
                <View style={styles.photoRow}>
                  {storagePhotos.map((photo) => (
                    <View key={photo.id} style={styles.photoBox}>
                      <Image src={photo.url} style={styles.photo} />
                      <Text style={styles.photoLabel}>{photo.label}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
            <Text style={styles.pageNumber} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} fixed />
          </Page>
        )
      })}

      <Page size="A4" style={styles.page}>
        <Text style={{ fontSize: 14, fontFamily: 'Helvetica-Bold', marginBottom: 12 }}>Resumen — {client.name}</Text>
        <View style={styles.summaryTable}>
          <View style={[styles.summaryRow, styles.summaryHeader]}>
            <Text style={styles.summaryCellBold}>Envase</Text>
            <Text style={styles.summaryCellBold}>Tipo</Text>
            <Text style={styles.summaryCellBold}>Tara (kg)</Text>
            <Text style={styles.summaryCellBold}>Bruto (kg)</Text>
            <Text style={styles.summaryCellBold}>Neto (kg)</Text>
          </View>
          {containerData.map(({ container, reception }) => {
            const net = reception
              ? Math.round((reception.gross_weight_kg - container.tare_weight_kg) * 100) / 100
              : null
            return (
              <View key={container.id} style={styles.summaryRow}>
                <Text style={styles.summaryCell}>{container.id}</Text>
                <Text style={styles.summaryCell}>{WASTE_LABELS[container.waste_type]}</Text>
                <Text style={styles.summaryCell}>{container.tare_weight_kg}</Text>
                <Text style={styles.summaryCell}>{reception?.gross_weight_kg ?? '—'}</Text>
                <Text style={styles.summaryCellBold}>{net ?? '—'}</Text>
              </View>
            )
          })}
          <View style={[styles.summaryRow, { borderTop: '1 solid #cbd5e1' }]}>
            <Text style={[styles.summaryCellBold, { flex: 4 }]}></Text>
            <Text style={styles.summaryCellBold}>{totalNetWeight.toFixed(1)} kg</Text>
          </View>
        </View>
        <Text style={styles.pageNumber} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} fixed />
      </Page>
    </Document>
  )
}
