import type { Tables, TablesInsert } from '../database.types'
import { selectAll, unwrap, type DB } from './_helpers'

export type TreatmentRunRow = Tables<'treatment_runs'>

export async function createTreatmentRun(
  db: DB,
  input: TablesInsert<'treatment_runs'>,
): Promise<TreatmentRunRow> {
  return unwrap(await db.from('treatment_runs').insert(input).select().single())
}

export async function listTreatmentRuns(db: DB): Promise<TreatmentRunRow[]> {
  return selectAll<TreatmentRunRow>((desde, hasta) =>
    db.from('treatment_runs').select('*').order('started_at').order('id').range(desde, hasta)
  )
}
