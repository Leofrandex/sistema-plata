'use client'

import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'
import { sessionStorageAdapter } from './session-storage'

/**
 * Cliente Supabase de cliente puro (sin servidor/middleware). La sesión vive en
 * `sessionStorage` y `supabase-js` la refresca sola (`autoRefreshToken`).
 * Singleton para no crear múltiples GoTrueClient.
 */
let client: SupabaseClient<Database> | null = null

export function createClient(): SupabaseClient<Database> {
  if (client) return client
  client = createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      auth: {
        storage: sessionStorageAdapter,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    }
  )
  return client
}
