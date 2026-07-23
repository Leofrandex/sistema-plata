import type { LocalStore } from './types'

export interface LocalSnapshot {
  routeEvents: Array<Record<string, unknown>>
  weighingSessions: Array<Record<string, unknown>>
  receptions: Array<Record<string, unknown>>
  treatmentRuns: Array<Record<string, unknown>>
  containerLocations: Array<Record<string, unknown>>
  storageEvents: Array<Record<string, unknown>>
  dirtyByEvent: Map<string, string[]>
  cleanByEvent: Map<string, string[]>
}

/** Todo lo local (synced o no): es el estado del día del dispositivo. */
export async function hydrateFromLocal(store: LocalStore): Promise<LocalSnapshot> {
  const payloadsOf = async (tbl: Parameters<LocalStore['getRows']>[0]) =>
    (await store.getRows(tbl)).map((r) => r.payload)

  const joinMap = async (tbl: 'route_event_containers_dirty' | 'route_event_containers_clean') => {
    const m = new Map<string, string[]>()
    for (const r of await store.getRows(tbl)) {
      const ev = r.payload.route_event_id as string
      m.set(ev, [...(m.get(ev) ?? []), r.payload.container_id as string])
    }
    return m
  }

  return {
    routeEvents: await payloadsOf('route_events'),
    weighingSessions: await payloadsOf('weighing_sessions'),
    receptions: await payloadsOf('container_receptions'),
    treatmentRuns: await payloadsOf('treatment_runs'),
    containerLocations: await payloadsOf('container_locations'),
    storageEvents: await payloadsOf('storage_events'),
    dirtyByEvent: await joinMap('route_event_containers_dirty'),
    cleanByEvent: await joinMap('route_event_containers_clean'),
  }
}

/** Ids de registros aún no subidos — lo que el merge del hydrator debe preservar. */
export async function localPendingIds(store: LocalStore): Promise<Set<string>> {
  const rows = await store.getUnsyncedRows()
  return new Set(rows.map((r) => r.id))
}
