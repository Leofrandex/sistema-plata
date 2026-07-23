import { createClient } from '@hospiwaste/shared/lib/supabase/client'
import { clearLoginAt } from '@hospiwaste/shared/lib/session-timeout'

/** Cierra la sesión en cliente y limpia el ancla de auto-logout. No lanza:
 * aunque el signOut remoto falle (sin red), limpia el estado local. Con
 * `scope: 'local'` no revoca la familia de tokens en el server — necesario
 * cuando el drain nativo del APK todavía tiene cola pendiente (I1). */
export async function signOut(opts: { scope?: 'global' | 'local' | 'others' } = {}): Promise<void> {
  try {
    await createClient().auth.signOut(opts.scope ? { scope: opts.scope } : undefined)
  } catch {
    // Sin red / Supabase caído: igual limpiamos el estado local y seguimos.
  }
  clearLoginAt()
}
