import {
  treatmentRunId,
  treatmentLocationId,
  type TreatmentCandidate,
} from '@hospiwaste/shared/lib/data/treatment'
import type {
  ContainerLocation, StorageEvent, TreatmentRun,
} from '@hospiwaste/shared/lib/types'
import { submitTreatmentRun, submitStorageExit, submitContainerLocation } from './field-writes'

export interface TreatmentStoreSink {
  addTreatmentRun: (run: TreatmentRun) => void
  updateStorageEvent: (id: string, updates: Partial<StorageEvent>) => void
  addLocation: (location: ContainerLocation) => void
}

export interface TreatResult {
  /** Tachos efectivamente escritos en el store local. */
  treated: number
  /** container_id donde se cortó, o null si entraron todos. */
  failedAt: string | null
  error: unknown
}

/** Registra el tratamiento de los tachos dados. Por cada uno, en orden:
 *  treatment_run → cierre del exit_at de cámara fría → container_location.
 *
 *  NO es atómico: el outbox es fila por fila y no hay transacción entre las
 *  tres. La garantía es que todo se escribe al SQLite local (durable) antes de
 *  que salga nada a la red. Si un tacho falla, se corta: los anteriores quedan
 *  registrados y los restantes siguen en la cola, que es derivada. */
export async function treatContainers(
  candidates: TreatmentCandidate[],
  operatorId: string,
  nowIso: string,
  sink: TreatmentStoreSink,
): Promise<TreatResult> {
  let treated = 0

  for (const { container, reception, storageEvent } of candidates) {
    try {
      const runId = await treatmentRunId(container.id, reception.id)
      const run = {
        id: runId,
        container_id: container.id,
        started_at: nowIso,
        completed_at: nowIso,
        operator_id: operatorId,
      }
      await submitTreatmentRun(run)
      sink.addTreatmentRun(run)

      if (storageEvent.exit_at === null) {
        await submitStorageExit({
          id: storageEvent.id,
          container_id: storageEvent.container_id,
          entry_at: storageEvent.entry_at,
          exit_at: nowIso,
          operator_id: storageEvent.operator_id,
        })
        sink.updateStorageEvent(storageEvent.id, { exit_at: nowIso })
      }

      const location: ContainerLocation = {
        id: await treatmentLocationId(container.id, reception.id),
        container_id: container.id,
        reported_at: nowIso,
        operator_id: operatorId,
        location_type: 'treatment',
        client_id: null,
        floor: null,
        area: null,
        notes: 'Tratamiento',
      }
      await submitContainerLocation(location)
      sink.addLocation(location)

      treated += 1
    } catch (error) {
      return { treated, failedAt: container.id, error }
    }
  }

  return { treated, failedAt: null, error: null }
}
