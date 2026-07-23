'use client'

import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'
import { sessionStorageAdapter } from './session-storage'
import { preferencesStorageAdapter } from './preferences-storage'

/**
 * Adapter híbrido: en el APK (nativo) la sesión vive en `@capacitor/preferences`
 * (sobrevive al cierre del WebView, expira por inactividad — ver
 * `preferences-storage.ts`); en web (hub y dev) se mantiene `sessionStorage`
 * (semántica de "cookie de sesión", sin cambios).
 *
 * La detección de plataforma es async (`Capacitor.isNativePlatform()` requiere
 * el import dinámico de `@capacitor/core`), así que no puede resolverse a nivel
 * de módulo de forma síncrona. Cada método decide en su primera invocación y
 * memoiza el resultado — supabase-js acepta storages cuyos métodos devuelven
 * promesas.
 */
let resolvedAdapter: typeof sessionStorageAdapter | typeof preferencesStorageAdapter | null = null

async function resolveAdapter() {
  if (resolvedAdapter) return resolvedAdapter
  try {
    const { Capacitor } = await import('@capacitor/core')
    resolvedAdapter = Capacitor.isNativePlatform() ? preferencesStorageAdapter : sessionStorageAdapter
  } catch {
    resolvedAdapter = sessionStorageAdapter
  }
  return resolvedAdapter
}

const hybridStorageAdapter = {
  async getItem(key: string): Promise<string | null> {
    return (await resolveAdapter()).getItem(key)
  },
  async setItem(key: string, value: string): Promise<void> {
    await (await resolveAdapter()).setItem(key, value)
  },
  async removeItem(key: string): Promise<void> {
    await (await resolveAdapter()).removeItem(key)
  },
}

/**
 * Cliente Supabase de cliente puro (sin servidor/middleware). La sesión vive en
 * el adapter híbrido de arriba y `supabase-js` la refresca sola (`autoRefreshToken`).
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
        storage: hybridStorageAdapter,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    }
  )
  return client
}
