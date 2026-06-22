/**
 * Capa de queries tipadas contra Supabase.
 *
 * Convención:
 *   import { createClient } from '@/lib/supabase/client'   // (o /server)
 *   import * as q from '@/lib/supabase/queries'
 *
 *   const db = createClient()
 *   const containers = await q.listContainers(db)
 *
 * Cada función:
 *   - recibe `db: DB` como primer argumento (cliente browser o server)
 *   - lanza Error si Supabase devolvió error
 *   - devuelve datos tipados con Tables<>/Row directos (no { data, error })
 */

export * from './_helpers'
export * from './containers'
export * from './clients'
export * from './companies'
export * from './login-directory'
export * from './photos'
export * from './profiles'
export * from './route-events'
export * from './storage'
export * from './treatment'
export * from './weighing'
