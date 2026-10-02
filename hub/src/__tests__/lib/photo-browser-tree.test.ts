import type { ContainerReception, Photo, WeighingSession } from '@hospiwaste/shared/lib/types'
import { buildPhotoBrowserTree } from '@/lib/data/photo-browser-tree'

const ph = (id: string): Photo => ({ id, url: `u-${id}`, event_type: 'weighing', event_id: 'e', taken_at: '', label: '' })

const rec = (p: Partial<ContainerReception> & { id: string; arrived_at: string }): ContainerReception => ({
  container_id: null,
  weighing_session_id: null,
  gross_weight_kg: 10,
  operator_id: 'user-1',
  photo_ids: [`${p.id}-t`, `${p.id}-s`],
  observations: '',
  company_id: 'company-ion',
  ...p,
})

const session = (id: string, started_at: string) =>
  ({ id, client_id: 'client-1', date: started_at.slice(0, 10), started_at, ended_at: null, operator_id: 'user-1', status: 'completed', reception_ids: [] }) as unknown as WeighingSession

const photosFor = (...ids: string[]) => ids.flatMap((id) => [ph(`${id}-t`), ph(`${id}-s`)])

describe('buildPhotoBrowserTree', () => {
  const sessions = [session('s-tarde', '2026-05-17T15:00:00-05:00'), session('s-manana', '2026-05-17T09:00:00-05:00')]
  const receptions = [
    rec({ id: 'r1', arrived_at: '2026-05-17T15:10:00-05:00', container_id: '173', weighing_session_id: 's-tarde' }),
    rec({ id: 'r2', arrived_at: '2026-05-17T09:05:00-05:00', container_id: '052', weighing_session_id: 's-manana' }),
    rec({ id: 'r3', arrived_at: '2026-05-17T10:00:00-05:00', container_ref: '5501', waste_type: 'morgue' }),
    rec({ id: 'r4', arrived_at: '2026-05-18T09:00:00-05:00', container_id: '001', weighing_session_id: 'no-existe' }),
  ]
  const tree = buildPhotoBrowserTree(receptions, sessions, photosFor('r1', 'r2', 'r3', 'r4'))

  it('agrupa por día, en orden', () => {
    expect(tree.map((d) => d.date)).toEqual(['2026-05-17', '2026-05-18'])
  })

  it('sesiones por hora de inicio, numeradas; "Sin sesión" al final', () => {
    const labels = tree[0].sessions.map((s) => s.label)
    expect(labels[0]).toMatch(/^Sesión 1 · /)
    expect(labels[1]).toMatch(/^Sesión 2 · /)
    expect(labels[2]).toBe('Sin sesión')
    expect(tree[0].sessions[0].items.map((i) => i.label)).toEqual(['Tacho 052'])
    expect(tree[0].sessions[1].items.map((i) => i.label)).toEqual(['Tacho 173'])
  })

  it('contenedor descartable con su número y tipo', () => {
    expect(tree[0].sessions[2].items[0].label).toBe('Contenedor 5501 (Morgue)')
  })

  it('una sesión que no está en el store cae en "Sin sesión"', () => {
    expect(tree[1].sessions.map((s) => s.label)).toEqual(['Sin sesión'])
  })

  it('balanza = photo_ids[1], tacho = photo_ids[0]', () => {
    const item = tree[0].sessions[0].items[0]
    expect(item.tacho?.id).toBe('r2-t')
    expect(item.scale?.id).toBe('r2-s')
  })

  it('omite pesajes sin ninguna foto encontrada; conserva los que tienen una sola', () => {
    const t = buildPhotoBrowserTree(
      [rec({ id: 'x', arrived_at: '2026-05-17T09:00:00-05:00', container_id: '9' }), rec({ id: 'y', arrived_at: '2026-05-17T09:30:00-05:00', container_id: '8' })],
      [],
      [ph('y-t')],
    )
    const items = t[0].sessions[0].items
    expect(items.map((i) => i.label)).toEqual(['Tacho 8'])
    expect(items[0].scale).toBeNull()
  })
})
