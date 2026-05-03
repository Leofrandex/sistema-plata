import type { Metadata } from 'next'
import { Plus_Jakarta_Sans } from 'next/font/google'
import './globals.css'
import { Sidebar } from '@/components/layout/sidebar'
import { MobileHeader } from '@/components/layout/mobile-header'
import { SyncIndicator } from '@/components/layout/sync-indicator'

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans',
})

export const metadata: Metadata = {
  title: 'Hospimed — Trazabilidad',
  description: 'Sistema de trazabilidad de desechos clínicos',
  manifest: '/manifest.json',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className={`${plusJakartaSans.variable} font-sans`}>
        <div className="flex min-h-screen bg-slate-50">
          <Sidebar />
          <div className="flex-1 flex flex-col">
            <MobileHeader />
            <main className="flex-1 p-4 md:p-6">{children}</main>
            <SyncIndicator />
          </div>
        </div>
      </body>
    </html>
  )
}
