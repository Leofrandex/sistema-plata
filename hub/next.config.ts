import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'export',
  images: {
    // El optimizador de imágenes de Next no corre en export estático.
    unoptimized: true,
    remotePatterns: [
      { protocol: 'https', hostname: 'placehold.co' },
      { protocol: 'https', hostname: '*.supabase.co', pathname: '/storage/v1/object/**' },
    ],
  },
  transpilePackages: ['@react-pdf/renderer', '@hospiwaste/shared'],
}

export default nextConfig
