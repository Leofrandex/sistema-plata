import type { TablesInsert } from '@hospiwaste/shared/lib/supabase/database.types'
import { enqueueOp } from '@hospiwaste/shared/lib/offline-queue'

export function weighingSessionOpId(id: string): string { return `ws:${id}` }
export function receptionOpId(id: string): string { return `rec:${id}` }
export function routeEventOpId(id: string): string { return `re:${id}` }

/** Notifica al hook de sync que hay ops nuevas (drena si hay conexión). */
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
  await enqueueOp({
    op_id: weighingSessionOpId(input.id),
    type: 'create_weighing_session',
    payload: { ...rest, status, ended_at } satisfies TablesInsert<'weighing_sessions'>,
    deps: [],
  })
  notifyOutboxChanged()
}

export async function submitReception(
  input: TablesInsert<'container_receptions'> & { id: string; weighing_session_id: string }
): Promise<void> {
  await enqueueOp({
    op_id: receptionOpId(input.id),
    type: 'create_reception',
    payload: input,
    deps: [weighingSessionOpId(input.weighing_session_id)],
  })
  notifyOutboxChanged()
}

export async function submitRouteEvent(
  input: TablesInsert<'route_events'> & { id: string },
  dirty: string[],
  clean: string[],
): Promise<void> {
  await enqueueOp({
    op_id: routeEventOpId(input.id),
    type: 'create_route_event',
    payload: input,
    deps: [],
  })
  if (dirty.length > 0) {
    await enqueueOp({
      op_id: `rc:${input.id}:dirty`,
      type: 'add_route_containers',
      payload: { table: 'route_event_containers_dirty', rows: dirty.map((cid) => ({ route_event_id: input.id, container_id: cid })) },
      deps: [routeEventOpId(input.id)],
    })
  }
  if (clean.length > 0) {
    await enqueueOp({
      op_id: `rc:${input.id}:clean`,
      type: 'add_route_containers',
      payload: { table: 'route_event_containers_clean', rows: clean.map((cid) => ({ route_event_id: input.id, container_id: cid })) },
      deps: [routeEventOpId(input.id)],
    })
  }
  notifyOutboxChanged()
}

export async function submitTreatmentRun(input: {
  id: string; container_id: string; started_at: string; completed_at: string; operator_id: string
}): Promise<void> {
  await enqueueOp({
    op_id: `tr:${input.id}`, type: 'create_treatment_run',
    payload: input satisfies TablesInsert<'treatment_runs'>, deps: [],
  })
  notifyOutboxChanged()
}

export async function submitStorageEvent(input: {
  id: string; container_id: string; entry_at: string; operator_id: string
}): Promise<void> {
  await enqueueOp({
    op_id: `se:${input.id}`, type: 'create_storage_event',
    payload: { ...input, exit_at: null } satisfies TablesInsert<'storage_events'>, deps: [],
  })
  notifyOutboxChanged()
}

export async function submitContainerLocation(
  input: TablesInsert<'container_locations'> & { id: string }
): Promise<void> {
  await enqueueOp({
    op_id: `cl:${input.id}`, type: 'create_container_location', payload: input, deps: [],
  })
  notifyOutboxChanged()
}
