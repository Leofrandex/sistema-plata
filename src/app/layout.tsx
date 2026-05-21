import type { Metadata } from 'next'
import { Plus_Jakarta_Sans } from 'next/font/google'
import './globals.css'
import { Sidebar } from '@/components/layout/sidebar'
import { MobileHeader } from '@/components/layout/mobile-header'
import { MobileBottomNav } from '@/components/layout/mobile-bottom-nav'
import { SyncIndicator } from '@/components/layout/sync-indicator'
import { SWCleanup } from '@/components/layout/sw-cleanup'
import { SupabaseHydrator } from '@/components/supabase-hydrator'
import { APP_NAME, APP_DESCRIPTION, APP_TAGLINE } from '@/lib/constants'

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
        <SWCleanup />
        <SupabaseHydrator />
        <div className="flex min-h-screen bg-background">
          <Sidebar />
          <div className="flex-1 flex flex-col">
            <MobileHeader />
            <main className="flex-1 p-4 md:p-6 pb-24 md:pb-6">{children}</main>
            <SyncIndicator />
          </div>
          <MobileBottomNav />
        </div>
      </body>
    </html>
  )
}
