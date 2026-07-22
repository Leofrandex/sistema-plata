import type { UserRole } from '@hospiwaste/shared/lib/types'
import { unwrap, type DB } from './_helpers'

export interface LoginDirectoryEntry {
  id: string
  name: string
  role: UserRole
  email: string
}

/**
 * Lista el directorio público de usuarios (nombre + rol + email) para poblar
 * las tarjetas de /login. Legible sin sesión (vista login_directory).
 */
export async function getLoginDirectory(db: DB): Promise<LoginDirectoryEntry[]> {
  const rows = unwrap(
    await db.from('login_directory').select('id, name, role, email').order('name')
  )
  return rows.map((r) => ({
    id: r.id as string,
    name: r.name as string,
    role: r.role as UserRole,
    email: (r.email ?? '') as string,
  }))
}
