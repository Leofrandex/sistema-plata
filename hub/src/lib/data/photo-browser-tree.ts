import type { ContainerReception, Photo, WeighingSession } from '@hospiwaste/shared/lib/types'
import { WASTE_TYPE_LABELS } from '@hospiwaste/shared/lib/data/dashboard-analytics'
import { isoDate } from './reports'

/**
 * Árbol del buscador del editor del registro: día → sesión de pesaje →
 * tacho o contenedor descartable → foto de balanza y foto del tacho.
 * Recibe las recepciones ya filtradas (`selectReportReceptions`).
 */

export interface BrowserItem {
  key: string
  label: string
  scale: Photo | null // photo_ids[1]
  tacho: Photo | null // photo_ids[0]
}

export interface BrowserSession {
  key: string
  label: string
  items: BrowserItem[]
}

export interface BrowserDay {
  date: string
  sessions: BrowserSession[]
}

const NO_SESSION = ''

const time = (iso: string) => new Date(iso).getTime()

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })
}

function itemLabel(rec: ContainerReception): string {
  if (rec.container_id) return `Tacho ${rec.container_id}`
  const tipo = rec.waste_type ? ` (${WASTE_TYPE_LABELS[rec.waste_type]})` : ''
  return `Contenedor ${rec.container_ref || 's/n'}${tipo}`
}

export function buildPhotoBrowserTree(
  receptions: ContainerReception[],
  sessions: WeighingSession[],
  photos: Photo[],
): BrowserDay[] {
  const photoMap = new Map(photos.map((p) => [p.id, p]))
  const sessionMap = new Map(sessions.map((s) => [s.id, s]))
  const photo = (id: string | undefined) => (id ? photoMap.get(id) ?? null : null)

  // date → sessionKey → items (en orden de pesaje)
  const byDay = new Map<string, Map<string, BrowserItem[]>>()
  const sorted = [...receptions].sort((a, b) => time(a.arrived_at) - time(b.arrived_at))
  for (const rec of sorted) {
    const item: BrowserItem = { key: rec.id, label: itemLabel(rec), tacho: photo(rec.photo_ids[0]), scale: photo(rec.photo_ids[1]) }
    if (!item.tacho && !item.scale) continue
    const date = isoDate(new Date(rec.arrived_at))
    const sessionKey = rec.weighing_session_id && sessionMap.has(rec.weighing_session_id) ? rec.weighing_session_id : NO_SESSION
    const day = byDay.get(date) ?? new Map<string, BrowserItem[]>()
    byDay.set(date, day)
    day.set(sessionKey, [...(day.get(sessionKey) ?? []), item])
  }

  return [...byDay.keys()].sort().map((date) => {
    const day = byDay.get(date)!
    const sessionIds = [...day.keys()]
      .filter((k) => k !== NO_SESSION)
      .sort((a, b) => time(sessionMap.get(a)!.started_at) - time(sessionMap.get(b)!.started_at))
    const out: BrowserSession[] = sessionIds.map((id, i) => ({
      key: `${date}:${id}`,
      label: `Sesión ${i + 1} · ${formatTime(sessionMap.get(id)!.started_at)}`,
      items: day.get(id)!,
    }))
    const loose = day.get(NO_SESSION)
    if (loose) out.push({ key: `${date}:sin-sesion`, label: 'Sin sesión', items: loose })
    return { date, sessions: out }
  })
}
