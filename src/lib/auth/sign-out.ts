import { createClient } from '@/lib/supabase/client'
import { clearLoginAt } from '@/lib/session-timeout'

/** Cierra la sesión en cliente y limpia el ancla de auto-logout. */
export async function signOut(): Promise<void> {
  await createClient().auth.signOut()
  clearLoginAt()
}
