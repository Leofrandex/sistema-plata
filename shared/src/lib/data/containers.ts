import type {
  Container,
  ContainerLocation,
  ContainerPhase,
  ContainerReception,
  ContainerWithPhase,
  StorageEvent,
  TreatmentRun,
  ExternalTransfer,
  RouteEvent,
} from '@hospiwaste/shared/lib/types'

export function computeNetWeight(
  gross_weight_kg: number,
  tare_weight_kg: number
): number {
  return Math.round((gross_weight_kg - tare_weight_kg) * 100) / 100
}

export function getContainerCurrentLocation(
  locations: ContainerLocation[]
): ContainerLocation | null {
  if (locations.length === 0) return null
  return [...locations].sort(
    (a, b) => new Date(b.reported_at).getTime() - new Date(a.reported_at).getTime()
  )[0]
}

// Determina la fase actual del tacho en su ciclo de vida.
// routeEventIds: IDs de RouteEvents donde el tacho fue recogido sucio
// (containers_dirty_received). Solo los recogidos sucios disparan fase 'route';
// los entregados limpios no afectan la fase del tacho.
// - Recogido sucio sin recepción → 'route'
// - Recepción sin storage → 'weighing'
// - Storage sin exit → 'cold_storage'
// - Tratamiento/traslado activo → 'treatment' o 'transfer'
// - Todo cerrado → 'clean'
export function computeContainerPhase(
  routeEventIds: string[],
  reception: ContainerReception | null,
  storage: StorageEvent | null,
  treatmentOrTransfer: TreatmentRun | ExternalTransfer | null
): ContainerPhase {
  if (!reception && routeEventIds.length === 0) return 'clean'
  if (!reception) return 'route'
  // Un tratamiento/traslado (en curso o completado) cierra/avanza el ciclo aunque
  // no haya pasado por cámara fría (caso "tratado inmediatamente"). Se evalúa antes
  // que el storage.
  if (treatmentOrTransfer) {
    if ('completed_at' in treatmentOrTransfer) {
      return treatmentOrTransfer.completed_at ? 'clean' : 'treatment'
    }
    return (treatmentOrTransfer as ExternalTransfer).transferred_at ? 'clean' : 'transfer'
  }
  if (!storage) return 'weighing'
  // Sin tratamiento/traslado activo (ya descartado arriba): en cámara fría,
  // entrada con o sin salida sigue siendo cold_storage hasta que haya tratamiento.
  return 'cold_storage'
}

export function buildContainerWithPhase(
  container: Container,
  routeEventIds: string[],
  reception: ContainerReception | null,
  storage: StorageEvent | null,
  treatmentOrTransfer: TreatmentRun | ExternalTransfer | null,
  locations: ContainerLocation[]
): ContainerWithPhase {
  return {
    ...container,
    current_phase: computeContainerPhase(routeEventIds, reception, storage, treatmentOrTransfer),
    current_location: getContainerCurrentLocation(locations),
    latest_net_weight_kg: reception
      ? computeNetWeight(reception.gross_weight_kg, container.tare_weight_kg)
      : null,
  }
}

// Ayudante: obtiene los IDs de RouteEvents donde el tacho fue recogido sucio.
// Esto es lo que determina si está en fase 'route' (a la espera de pesaje).
// Los tachos entregados limpios NO disparan fase 'route' — siguen su fase actual.
export function getRouteEventIdsForContainer(
  routeEvents: RouteEvent[],
  containerId: string
): string[] {
  return routeEvents
    .filter((r) => !r.voided_at && r.containers_dirty_received.includes(containerId))
    .map((r) => r.id)
}

// Variante que considera ambos lados del recorrido. Útil para reportes y vistas
// históricas donde queremos mostrar todo el ciclo (limpio entregado + sucio recogido).
export function getRouteEventIdsAnyDirection(
  routeEvents: RouteEvent[],
  containerId: string
): string[] {
  return routeEvents
    .filter((r) =>
      !r.voided_at &&
      (r.containers_dirty_received.includes(containerId) ||
        r.containers_clean_delivered.includes(containerId)),
    )
    .map((r) => r.id)
}

// Cola de trabajo del pesador: tachos activos cuya última recogida sucia es
// POSTERIOR a su último pesaje vigente. La comparación es por fecha, no por
// existencia: el tacho recorre el ciclo muchas veces, así que cada recogida
// sucia reabre el pendiente aunque ya se haya pesado en ciclos anteriores.
// Las recepciones anuladas (voided_at != null, "deshacer pesaje") no cuentan:
// el tacho vuelve a pendiente.
export function getPendingWeighingContainerIds(
  containers: Container[],
  routeEvents: RouteEvent[],
  receptions: ContainerReception[]
): string[] {
  const ultimoPesajePorTacho = new Map<string, number>()
  for (const r of receptions) {
    if (r.voided_at) continue
    const ts = new Date(r.arrived_at).getTime()
    const previo = ultimoPesajePorTacho.get(r.container_id) ?? -Infinity
    if (ts > previo) ultimoPesajePorTacho.set(r.container_id, ts)
  }

  return containers
    .filter((c) => {
      if (c.status !== 'active') return false
      if (c.is_yaris_container) return false
      const recogidasSucias = routeEvents.filter(
        (r) => !r.voided_at && r.containers_dirty_received.includes(c.id),
      )
      if (recogidasSucias.length === 0) return false
      const ultimaRecogida = Math.max(
        ...recogidasSucias.map((r) => new Date(r.started_at).getTime()),
      )
      return ultimaRecogida > (ultimoPesajePorTacho.get(c.id) ?? -Infinity)
    })
    .map((c) => c.id)
}

/**
 * Tachos dedicados a "Metálicos No reutilizables" disponibles para pesar.
 * Siempre disponibles (no requieren recorrido), igual que los Yaris. Solo se
 * ofrecen en el formulario cuando el tipo de desecho elegido es 'metallic'.
 */
export function getMetallicContainers(containers: Container[]): Container[] {
  return containers.filter((c) => c.is_metallic_dedicated && c.status === 'active')
}

/**
 * Display del número de tacho sin el prefijo de empresa (artefacto histórico de
 * importación). 'A-001' → '001'. Ids sin prefijo se devuelven igual.
 */
export function formatTachoNumber(id: string): string {
  return id.replace(/^[A-Za-z]+-/, '')
}

/**
 * Empresa actual (dinámica) del tacho = company_id del recorrido más reciente
 * que lo recogió sucio DENTRO del ciclo abierto (posterior al último
 * tratamiento/traslado completado del tacho). Null si no hay recorrido abierto.
 * Implementa la herencia de empresa en pesaje y el reset automático al tratar.
 */
export function getContainerCurrentCompanyId(
  containerId: string,
  routeEvents: RouteEvent[],
  treatmentRuns: TreatmentRun[],
  transfers: ExternalTransfer[],
): string | null {
  const completions: number[] = [
    ...treatmentRuns
      .filter((t) => t.container_id === containerId && t.completed_at)
      .map((t) => new Date(t.completed_at as string).getTime()),
    ...transfers
      .filter((t) => t.container_id === containerId && t.transferred_at)
      .map((t) => new Date(t.transferred_at as string).getTime()),
  ]
  const boundary = completions.length ? Math.max(...completions) : -Infinity

  const open = routeEvents
    .filter(
      (r) =>
        r.containers_dirty_received.includes(containerId) &&
        new Date(r.started_at).getTime() > boundary,
    )
    .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime())

  return open[0]?.company_id ?? null
}

/**
 * Empresa "actual" de un tacho: la del registro NO anulado más reciente que lo
 * referencia (recepción por arrived_at, recorrido por started_at), considerando
 * solo registros con company_id. Devuelve null si ninguno aplica.
 * La empresa es del registro, no del tacho (decisions/2026-06-10-empresa-por-registro).
 */
export function deriveContainerCompanyId(
  containerId: string,
  routeEvents: RouteEvent[],
  receptions: ContainerReception[],
): string | null {
  let bestTs = -Infinity
  let bestCompany: string | null = null

  for (const r of receptions) {
    if (r.voided_at) continue
    if (r.container_id !== containerId) continue
    if (!r.company_id) continue
    const ts = new Date(r.arrived_at).getTime()
    if (ts > bestTs) { bestTs = ts; bestCompany = r.company_id }
  }
  for (const e of routeEvents) {
    if (e.voided_at) continue
    if (!e.company_id) continue
    if (!e.containers_dirty_received.includes(containerId) && !e.containers_clean_delivered.includes(containerId)) continue
    const ts = new Date(e.started_at).getTime()
    if (ts > bestTs) { bestTs = ts; bestCompany = e.company_id }
  }
  return bestCompany
}
