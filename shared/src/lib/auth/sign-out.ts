import { createClient } from '@hospiwaste/shared/lib/supabase/client'
import { clearLoginAt } from '@hospiwaste/shared/lib/session-timeout'

/** Cierra la sesión en cliente y limpia el ancla de auto-logout. No lanza:
 * aunque el signOut remoto falle (sin red), limpia el estado local. */
export async function signOut(): Promise<void> {
  try {
    await createClient().auth.signOut()
  } catch {
    // Sin red / Supabase caído: igual limpiamos el estado local y seguimos.
  }
  clearLoginAt()
}
