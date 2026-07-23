import type { TablesInsert } from '@hospiwaste/shared/lib/supabase/database.types'
import { getLocalStore } from '@hospiwaste/shared/lib/local-store'

/** Notifica al hook de sync que hay filas locales nuevas (drena si hay conexión). */
export function notifyOutboxChanged(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('hospiwaste:outbox-changed'))
  }
}

export async function submitWeighingSession(input: {
  id: string; client_id: string; date: string; started_at: string; operator_id: string
  status?: 'in_progress' | 'completed'; ended_at?: string | null
}): Promise<void> {
  const { status = 'in_progress', ended_at = null, ...rest } = input
  const store = await getLocalStore()
  await store.putRow('weighing_sessions', input.id,
    { ...rest, status, ended_at } satisfies TablesInsert<'weighing_sessions'>)
  notifyOutboxChanged()
}

export async function submitReception(
  input: TablesInsert<'container_receptions'> & { id: string; weighing_session_id: string },
): Promise<void> {
  const store = await getLocalStore()
  await store.putRow('container_receptions', input.id, input)
  notifyOutboxChanged()
}

export async function submitRouteEvent(
  input: TablesInsert<'route_events'> & { id: string },
  dirty: string[],
  clean: string[],
): Promise<void> {
  const store = await getLocalStore()
  await store.putRow('route_events', input.id, input)
  for (const cid of dirty) {
    await store.putRow('route_event_containers_dirty', `${input.id}:${cid}`,
      { route_event_id: input.id, container_id: cid })
  }
  for (const cid of clean) {
    await store.putRow('route_event_containers_clean', `${input.id}:${cid}`,
      { route_event_id: input.id, container_id: cid })
  }
  notifyOutboxChanged()
}

export async function submitTreatmentRun(input: {
  id: string; container_id: string; started_at: string; completed_at: string; operator_id: string
}): Promise<void> {
  const store = await getLocalStore()
  await store.putRow('treatment_runs', input.id, input satisfies TablesInsert<'treatment_runs'>)
  notifyOutboxChanged()
}

export async function submitStorageEvent(input: {
  id: string; container_id: string; entry_at: string; operator_id: string
}): Promise<void> {
  const store = await getLocalStore()
  await store.putRow('storage_events', input.id,
    { ...input, exit_at: null } satisfies TablesInsert<'storage_events'>)
  notifyOutboxChanged()
}

export async function submitContainerLocation(
  input: TablesInsert<'container_locations'> & { id: string },
): Promise<void> {
  const store = await getLocalStore()
  await store.putRow('container_locations', input.id, input)
  notifyOutboxChanged()
}
