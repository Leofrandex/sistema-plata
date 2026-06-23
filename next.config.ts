import type { NextConfig } from 'next'
// eslint-disable-next-line @typescript-eslint/no-require-imports
const withPWA = require('next-pwa')

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'placehold.co' },
      // URLs firmadas del bucket `photos` de Supabase Storage
      { protocol: 'https', hostname: '*.supabase.co', pathname: '/storage/v1/object/**' },
    ],
  },
  transpilePackages: ['@react-pdf/renderer'],
  turbopack: {},
}

export default withPWA({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
  // Set de estrategias por defecto de next-pwa: NetworkFirst para documentos y
  // recursos cross-origin, StaleWhileRevalidate para JS/CSS/_next static, caché
  // de imágenes y fuentes. Cubre la navegación y la carga de chunks offline.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  runtimeCaching: require('next-pwa/cache'),
  // Cachea las páginas al navegar por la app (no solo al recargar) → arranque
  // en frío y navegación a rutas ya visitadas funcionan offline.
  cacheOnFrontEndNav: true,
  // Recarga al recuperar conexión para tomar la última versión.
  reloadOnOnline: true,
  // Documento servido cuando una navegación offline no tiene caché.
  fallbacks: { document: '/offline' },
})(nextConfig)
