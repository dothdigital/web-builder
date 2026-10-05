import { fileURLToPath } from 'node:url'
import { config as loadEnv } from 'dotenv'
import type { NextConfig } from 'next'

/// One .env at the repo root feeds the web app, the worker and Prisma, so the
/// database URL and AI keys are never duplicated per app.
loadEnv({ path: fileURLToPath(new URL('../../.env', import.meta.url)), override: true })


const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: '/:path*', headers: [
      { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
      { key: 'Content-Security-Policy', value: "frame-ancestors 'self'; object-src 'none'; base-uri 'self'" },
      { key: 'Strict-Transport-Security', value: 'max-age=31536000' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    ] }, ...['/api/projects/:id/editor-image', '/uploads/:path*'].map(source => ({ source, headers: [{ key: 'Content-Security-Policy', value: "sandbox; default-src 'none'; img-src data:; style-src 'unsafe-inline'" }] }))]
  },
  /// Workspace packages ship TypeScript source, so Next compiles them itself.
  transpilePackages: [
    '@awb/ai',
    '@awb/component-registry',
    '@awb/database',
    '@awb/pipeline',
    '@awb/seo',
    '@awb/shared',
    '@awb/website-model',
  ],
  serverExternalPackages: ['sharp', 'bullmq', 'ioredis', '@prisma/client', '@prisma/adapter-pg'],
  images: { remotePatterns: [{ protocol: 'https', hostname: '**' }] },
}

export default nextConfig
