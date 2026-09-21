import type { Tables } from '../database.types'
import { selectAll, type DB } from './_helpers'

export type TreatmentRunRow = Tables<'treatment_runs'>

export async function listTreatmentRuns(db: DB): Promise<TreatmentRunRow[]> {
  return selectAll<TreatmentRunRow>((desde, hasta) =>
    db.from('treatment_runs').select('*').order('started_at').order('id').range(desde, hasta)
  )
}
