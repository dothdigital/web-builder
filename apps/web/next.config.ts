import { fileURLToPath } from 'node:url'
import { config as loadEnv } from 'dotenv'
import type { NextConfig } from 'next'

/// One .env at the repo root feeds the web app, the worker and Prisma, so the
/// database URL and AI keys are never duplicated per app.
loadEnv({ path: fileURLToPath(new URL('../../.env', import.meta.url)), override: true })


const nextConfig: NextConfig = {
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
