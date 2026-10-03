import { z } from 'zod'

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  AUTH_SECRET: z.string().min(1).default('development-secret-change-me'),
  AUTH_URL: z.string().default('http://localhost:3000'),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  AI_PROVIDER: z.enum(['stub', 'openai']).default('stub'),
  OPENAI_API_KEY: z.string().optional(),
  S3_REGION: z.string().default('us-east-1'),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_PUBLIC_BASE_URL: z.string().optional(),
  S3_ENDPOINT: z.string().optional(),
  LOCAL_UPLOAD_DIR: z.string().default('.uploads'),
  PLATFORM_DOMAIN: z.string().default('localhost:3000'),
  /// When false the queue is bypassed and jobs run inline, which keeps the
  /// product usable on a machine without Redis.
  USE_REDIS_QUEUE: z
    .string()
    .default('true')
    .transform((value) => value !== 'false'),
})

export type Env = z.infer<typeof envSchema>

let cached: Env | undefined

export function env(): Env {
  if (!cached) {
    const parsed = envSchema.safeParse(process.env)

    if (!parsed.success) {
      throw new Error(`Invalid environment: ${parsed.error.issues.map((issue) => issue.path.join('.')).join(', ')}`)
    }

    cached = parsed.data
  }

  return cached
}
