import type { ContainerReception } from '@hospiwaste/shared/lib/types'

/** Solo los pesajes con tacho pasan a cámara fría / tratamiento al finalizar.
 *  Los contenedores descartables (cito/anato/morgue) no tienen tacho: no hay
 *  StorageEvent ni ContainerLocation que registrar (container_id es FK NOT NULL ahí). */
export function receptionsNeedingStorage(receptions: ContainerReception[]): ContainerReception[] {
  return receptions.filter((r) => r.container_id != null)
}
