'use client'

import { createBrowserClient } from '@supabase/ssr'
import type { Database } from './database.types'

/**
 * Cliente Supabase para componentes/hooks del browser.
 * Lee la sesión desde cookies vía @supabase/ssr.
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  )
}
