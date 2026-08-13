import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const isVercelBuild = process.env.VERCEL === '1';
const vercelAdapterPath = fileURLToPath(new URL('./vercel.adapter.cjs', import.meta.url));

const nextConfig: NextConfig = {
  reactStrictMode: true,

  ...(isVercelBuild ? { adapterPath: vercelAdapterPath } : {}),

  // Vercel handles its own output packaging; keep standalone for non-Vercel self-hosting only.
  ...(isVercelBuild ? {} : { output: 'standalone' as const }),

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

  // Keep native/binary-dependent Node modules external — don't bundle them.
  // pdfkit resolves its AFM font data files relative to __dirname at runtime;
  // bundling it (Turbopack/webpack) rewrites __dirname and breaks that lookup,
  // causing ENOENT on Helvetica.afm. puppeteer-core/@sparticuz/chromium ship
  // a Chromium binary that must be required from disk at runtime, not bundled.
  serverExternalPackages: ['mysql2', 'pdfkit', 'puppeteer-core', '@sparticuz/chromium'],

  // pdfkit loads its standard-font .afm files from disk at runtime —
  // make sure they're included in the serverless function bundle.
  // @sparticuz/chromium ships its Chromium binary (~65MB across bin/*.br) the
  // same way — required from disk via executablePath(), not bundled — so the
  // fee-receipt-email route (the only one that renders HTML to PDF via
  // headless Chrome) needs the same explicit include or the binary is missing
  // at runtime on Vercel even though the build succeeds locally.
  outputFileTracingIncludes: {
    '/api/reports/fees/pdf/route': ['./node_modules/pdfkit/js/data/**/*'],
    '/api/fee-details/[studentId]/[feesId]/email/route': ['./node_modules/@sparticuz/chromium/bin/**/*'],
    // secure-spreadsheet is spawned as a subprocess (real MS-OFFCRYPTO/AES-256
    // xlsx encryption has no pure-JS-import library available) via a string
    // path, so Next's static import tracer can't see it — it and its
    // dependency tree must be explicitly included or the binary is missing
    // at runtime on Vercel even though the build succeeds locally.
    '/api/admission-activity/student/nsdc-export/route': [
      './node_modules/secure-spreadsheet/**/*',
      './node_modules/.bin/secure-spreadsheet',
      './node_modules/csv-parse/**/*',
      './node_modules/xlsx-populate/**/*',
      './node_modules/cfb/**/*',
      './node_modules/jszip/**/*',
      './node_modules/lodash/**/*',
      './node_modules/sax/**/*',
    ],
  },

  experimental: {
    // optimizeCss (critters) does fs.readFile calls that break Turbopack's NFT tracer on Vercel.
    // Disabled — the CSS savings are marginal and the build crash is not worth it.
    optimizeCss: false,
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
