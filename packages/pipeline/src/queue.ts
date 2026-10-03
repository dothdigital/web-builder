import { Queue } from 'bullmq'
import IORedis from 'ioredis'
import { env } from '@awb/shared'
import { type GenerationRequest } from './run'

export const GENERATION_QUEUE = 'website-generation'

let queue: Queue<GenerationRequest> | undefined
let connection: IORedis | undefined

export function redisConnection(): IORedis {
  if (!connection) {
    connection = new IORedis(env().REDIS_URL, { maxRetriesPerRequest: null })
  }

  return connection
}

export function generationQueue(): Queue<GenerationRequest> {
  if (!queue) {
    queue = new Queue<GenerationRequest>(GENERATION_QUEUE, { connection: redisConnection() })
  }

  return queue
}

export interface EnqueueResult {
  correlationId: string
  mode: 'queue'
}

// Generation runs in a separate worker.
export async function enqueueGeneration(request: GenerationRequest & { correlationId: string }): Promise<EnqueueResult> {
  if (!env().USE_REDIS_QUEUE) throw new Error('Background workers require Redis. Enable the worker queue before generating.')
  await generationQueue().add('generate', request, {
    jobId: request.correlationId, attempts: 3,
    backoff: { type: 'exponential', delay: 15000, jitter: 0.5 },
    removeOnComplete: { age: 86400, count: 1000 }, removeOnFail: { age: 604800, count: 2000 },
  })
  return { correlationId: request.correlationId, mode: 'queue' }
}
