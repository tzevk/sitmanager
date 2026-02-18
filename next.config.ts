import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // Standalone output — smaller serverless bundles on Vercel
  output: 'standalone',

  // Optimize images
  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60 * 60 * 24 * 30, // 30 days
    deviceSizes: [640, 750, 828, 1080, 1200],
    imageSizes: [16, 32, 48, 64, 96, 128, 256],
  },

  compress: true,
  poweredByHeader: false,

  // Turbopack config (required for Next.js 16+)
  turbopack: {},

  // Keep mysql2 as external — don't bundle native Node modules
  serverExternalPackages: ['mysql2'],

  experimental: {
    optimizeCss: true,
    optimizePackageImports: ['react-icons', 'jose', 'lucide-react', '@tiptap/react', '@tiptap/starter-kit'],
    staleTimes: {
      dynamic: 30,
      static: 180,
    },
  },

  // Headers for caching and security
  async headers() {
    return [
      {
        // Dashboard API — allow short caching + stale-while-revalidate
        source: '/api/dashboard',
        headers: [
          { key: 'Cache-Control', value: 'private, max-age=60, stale-while-revalidate=120' },
        ],
      },
      {
        // Dashboard sub-endpoints (stats, summary, reports)
        source: '/api/dashboard/:path*',
        headers: [
          { key: 'Cache-Control', value: 'private, max-age=60, stale-while-revalidate=120' },
        ],
      },
      {
        // Master options/dropdown APIs — cache longer
        source: '/api/:path*/options',
        headers: [
          { key: 'Cache-Control', value: 'private, max-age=300, stale-while-revalidate=600' },
        ],
      },
      {
        // All other APIs — no cache
        source: '/api/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-store, max-age=0' },
        ],
      },
      {
        // Static assets — immutable
        source: '/_next/static/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        // Fonts
        source: '/fonts/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        source: '/:path*',
        headers: [
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()' },
          { key: 'X-Permitted-Cross-Domain-Policies', value: 'none' },
        ],
      },
    ];
  },
};

export default nextConfig;
