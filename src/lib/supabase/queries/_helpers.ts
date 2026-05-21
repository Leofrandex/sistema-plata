import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../database.types'

/**
 * Cliente Supabase tipado contra el schema de Hospiwaste.
 * Acéptalo como parámetro en todas las queries para que funcionen igual
 * desde browser (`createClient()` de client.ts) y desde server
 * (`createClient()` de server.ts).
 */
export type DB = SupabaseClient<Database>

/**
 * Lanza si la respuesta de Supabase trae error. Devuelve `data!` ya tipado.
 * Patrón estándar: las queries devuelven los datos directamente, no `{data,error}`.
 */
export function unwrap<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message)
  if (res.data === null) throw new Error('Query returned null data')
  return res.data
}

/** Variante que admite `null` como resultado legítimo (single row optional). */
export function unwrapOrNull<T>(res: { data: T | null; error: { message: string } | null }): T | null {
  if (res.error && res.error.message !== 'JSON object requested, multiple (or no) rows returned') {
    throw new Error(res.error.message)
  }
  return res.data
}
