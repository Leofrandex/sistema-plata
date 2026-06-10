'use client'

import { createBrowserClient } from '@supabase/ssr'
import type { Database } from './database.types'
import {
  readDocumentCookies,
  sessionCookieOptions,
  writeDocumentCookie,
} from './cookie-session'

/**
 * Cliente Supabase para componentes/hooks del browser.
 * Lee la sesión desde cookies vía @supabase/ssr.
 *
 * Provee handlers de cookies propios para guardar la sesión como **cookie de
 * sesión** (sin maxAge/expires): así, al cerrar la app/PWA, la sesión se pierde
 * y se pide login de nuevo. Ver `cookie-session.ts`.
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return readDocumentCookies()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            writeDocumentCookie(name, value, sessionCookieOptions(value, options))
          )
        },
      },
    }
  )
}
