'use client'

import { AuthGuard } from '@hospiwaste/shared/components/layout/auth-guard'
import { isPublicPath } from '@/lib/auth/route-access'

/** Política de acceso del hub: solo coordinadores. */
export function HubAuthGuard({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard isPublicPath={isPublicPath} homePath="/dashboard" requiredRole="coordinator">
      {children}
    </AuthGuard>
  )
}
