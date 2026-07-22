'use client'

import { AuthGuard } from '@hospiwaste/shared/components/layout/auth-guard'
import { isPublicPath } from '@/lib/auth/route-access'

/** Política de acceso de la app de campo: cualquier rol logueado. */
export function AppAuthGuard({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard isPublicPath={isPublicPath} homePath="/">
      {children}
    </AuthGuard>
  )
}
