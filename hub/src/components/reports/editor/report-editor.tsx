'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import {
  DndContext, DragOverlay, PointerSensor, closestCenter, pointerWithin, useSensor, useSensors,
  type CollisionDetection, type DragEndEvent, type DragStartEvent,
} from '@dnd-kit/core'
import { Button } from '@hospiwaste/shared/components/ui/button'
import { useStore } from '@hospiwaste/shared/lib/store'
import {
  buildPhotographicReportData, parseReportRange, reportFilename, selectReportReceptions,
} from '@/lib/data/reports'
import {
  applyDragEnd, buildReportLayout, photoAt, usedPhotoIds, type DragRef, type ReportLayout,
} from '@/lib/data/report-layout'
import { buildPhotoBrowserTree } from '@/lib/data/photo-browser-tree'
import { DownloadButtonLabel, DownloadMessages, useReportDownload } from '../report-download'
import { PhotoBrowser } from './photo-browser'
import { ReportCanvas } from './report-canvas'

/**
 * Destinos válidos según lo que se arrastra: un cuadro cae sobre cuadros de su
 * mismo día (por cercanía); una foto, sobre el recuadro que está bajo el puntero.
 */
const collisionDetection: CollisionDetection = (args) => {
  const active = args.active.data.current as DragRef | undefined
  const refOf = (c: (typeof args.droppableContainers)[number]) => c.data.current as DragRef | undefined
  if (active?.type === 'cuadro') {
    const droppableContainers = args.droppableContainers.filter((c) => {
      const ref = refOf(c)
      return ref?.type === 'cuadro' && ref.date === active.date
    })
    return closestCenter({ ...args, droppableContainers })
  }
  const droppableContainers = args.droppableContainers.filter((c) => refOf(c)?.type === 'slot')
  return pointerWithin({ ...args, droppableContainers })
}

export function ReportEditor() {
  const params = useSearchParams()
  const companyId = params.get('company') ?? ''
  const range = useMemo(() => parseReportRange(params.get('start'), params.get('end')), [params])
  const { clients, companies, containers, routeEvents, weighingSessions, receptions, photos } = useStore()

  const data = useMemo(
    () =>
      range
        ? buildPhotographicReportData(companyId, { clients, companies, containers, routeEvents, weighingSessions, receptions, photos }, range)
        : null,
    [companyId, range, clients, companies, containers, routeEvents, weighingSessions, receptions, photos],
  )
  const tree = useMemo(
    () => (range ? buildPhotoBrowserTree(selectReportReceptions(companyId, receptions, range.start, range.end), weighingSessions, photos) : []),
    [companyId, range, receptions, weighingSessions, photos],
  )

  // Mientras no se edita, la maqueta sigue al store (que puede estar terminando
  // de cargar). La primera edición la congela: una actualización del store ya
  // no pisa lo editado.
  const baseLayout = useMemo(() => (data ? buildReportLayout(data) : null), [data])
  const [edited, setEdited] = useState<ReportLayout | null>(null)
  const layout = edited ?? baseLayout
  const used = useMemo(() => (layout ? usedPhotoIds(layout) : new Set<string>()), [layout])

  const [dirty, setDirty] = useState(false)
  const [dragging, setDragging] = useState<DragRef | null>(null)
  const { state, busy, download } = useReportDownload()
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  // Cerrar o recargar con cambios sin descargar: el navegador avisa.
  useEffect(() => {
    if (!dirty) return
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  if (!range || !companyId) return <EditorMessage text="Faltan la empresa o las fechas del reporte." />
  if (!data || !layout) {
    return <EditorMessage text={companies.length > 0 ? 'No se encontró la empresa del reporte.' : 'Cargando reporte…'} />
  }

  function change(next: ReportLayout) {
    setEdited(next)
    setDirty(true)
  }

  function handleDragStart(e: DragStartEvent) {
    setDragging((e.active.data.current as DragRef | undefined) ?? null)
  }

  function handleDragEnd(e: DragEndEvent) {
    setDragging(null)
    const active = e.active.data.current as DragRef | undefined
    if (!active || !layout) return
    const next = applyDragEnd(layout, active, (e.over?.data.current as DragRef | undefined) ?? null)
    if (next !== layout) change(next)
  }

  async function handleDownload() {
    if (!data || !layout) return
    if (await download(data, layout, reportFilename(data, '_editado'))) setDirty(false)
  }

  const overlayPhoto =
    dragging?.type === 'browser' ? dragging.photo : dragging?.type === 'slot' ? photoAt(layout, dragging) : null

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-background">
      <header className="flex items-center gap-4 border-b px-4 py-2">
        <Link
          href="/reports"
          onClick={(e) => {
            if (dirty && !window.confirm('Hay cambios sin descargar. ¿Salir del editor y perderlos?')) e.preventDefault()
          }}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver
        </Link>
        <h1 className="truncate text-sm font-semibold text-foreground">
          Editar reporte · {data.company.name} · {data.rangeStart} → {data.rangeEnd}
        </h1>
        <Button onClick={handleDownload} disabled={busy} className="ml-auto gap-2">
          <DownloadButtonLabel state={state} idleLabel="Descargar" />
        </Button>
      </header>
      {((state.phase === 'done' && state.missing > 0) || state.phase === 'error') && (
        <div className="border-b px-4 py-2">
          <DownloadMessages state={state} />
        </div>
      )}
      <DndContext
        sensors={sensors}
        collisionDetection={collisionDetection}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setDragging(null)}
      >
        <div className="flex min-h-0 flex-1">
          <aside className="w-72 shrink-0 overflow-y-auto border-r p-3">
            <PhotoBrowser tree={tree} used={used} />
          </aside>
          <main className="flex-1 overflow-y-auto bg-muted/40 p-6">
            <ReportCanvas layout={layout} companyName={data.company.name} onChange={change} />
          </main>
        </div>
        <DragOverlay dropAnimation={null}>
          {overlayPhoto ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={overlayPhoto.url} alt="" className="h-24 w-24 rounded bg-white object-contain shadow-xl ring-1 ring-black/10" />
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  )
}

function EditorMessage({ text }: { text: string }) {
  return (
    <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-3 bg-background text-sm text-muted-foreground">
      <p>{text}</p>
      <Link href="/reports" className="text-foreground underline">Volver a Reportes</Link>
    </div>
  )
}
