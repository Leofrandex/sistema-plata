import { getLocalStore } from '@hospiwaste/shared/lib/local-store'

/**
 * Espejos locales de borrados server-side. Sin esto, una fila local pendiente
 * (o su foto) re-sube en el próximo flush y "resucita" el registro borrado.
 * El borrado server ya ocurrió: un fallo del espejo local se loguea, no bloquea.
 */

/** Borra localmente un route_event: evento + filas join (dirty/clean) + fotos 'route'. */
export async function deleteLocalRouteEvent(id: string): Promise<void> {
  try {
    const store = await getLocalStore()
    await store.deleteRow('route_events', id)
    for (const tbl of ['route_event_containers_dirty', 'route_event_containers_clean'] as const) {
      const rows = await store.getRows(tbl)
      for (const r of rows) {
        if (r.payload.route_event_id === id) await store.deleteRow(tbl, r.id)
      }
    }
    await store.deletePhotosByEvent('route', id)
  } catch (err) {
    console.error('[local-store] espejo de borrado route_event falló:', err)
  }
}

/** Borra localmente una sesión de pesaje: sesión + receptions + fotos 'weighing' de cada reception. */
export async function deleteLocalWeighingSession(sessionId: string): Promise<void> {
  try {
    const store = await getLocalStore()
    const receptions = (await store.getRows('container_receptions'))
      .filter((r) => r.payload.weighing_session_id === sessionId)
    for (const r of receptions) {
      await store.deleteRow('container_receptions', r.id)
      await store.deletePhotosByEvent('weighing', r.id)
    }
    await store.deleteRow('weighing_sessions', sessionId)
  } catch (err) {
    console.error('[local-store] espejo de borrado weighing_session falló:', err)
  }
}
