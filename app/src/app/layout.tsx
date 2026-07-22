import type { Metadata } from 'next'
import { Plus_Jakarta_Sans } from 'next/font/google'
import './globals.css'
import { MobileHeader } from '@/components/layout/mobile-header'
import { MobileBottomNav } from '@/components/layout/mobile-bottom-nav'
import { SyncIndicator } from '@/components/layout/sync-indicator'
import { AppAuthGuard } from '@/components/layout/app-auth-guard'
import { OperatorSessionGuard } from '@/components/layout/operator-session-guard'
import { AppLifecycle } from '@/components/layout/app-lifecycle'
import { ErudaLoader } from '@/components/debug/eruda-loader'
import { SWCleanup } from '@hospiwaste/shared/components/layout/sw-cleanup'
import { ConnectionBanner } from '@hospiwaste/shared/components/layout/connection-banner'
import { SupabaseHydrator } from '@hospiwaste/shared/components/supabase-hydrator'
import { APP_NAME, APP_DESCRIPTION, APP_TAGLINE } from '@hospiwaste/shared/lib/constants'

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans',
})

export const metadata: Metadata = {
  title: `${APP_NAME} — ${APP_TAGLINE}`,
  description: APP_DESCRIPTION,
  manifest: '/manifest.json',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className={`${plusJakartaSans.variable} font-sans`}>
        <AppAuthGuard>
          <SWCleanup />
          <SupabaseHydrator />
          <AppLifecycle />
          <OperatorSessionGuard />
          <div className="flex min-h-screen bg-background">
            <div className="flex-1 flex flex-col">
              <MobileHeader />
              <ConnectionBanner />
              <main className="flex-1 p-4 md:p-6 pb-24">{children}</main>
              <SyncIndicator />
            </div>
            <MobileBottomNav />
          </div>
          <ErudaLoader />
        </AppAuthGuard>
      </body>
    </html>
  )
}
