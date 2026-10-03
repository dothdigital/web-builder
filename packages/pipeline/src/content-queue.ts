import { Queue } from 'bullmq'
import { prisma } from '@awb/database'
import { redisConnection, generationQueue } from './queue'
export const CONTENT_QUEUE = 'website-content'
let queue: Queue<{ contentJobId: string }> | undefined
export function contentQueue() { return queue ??= new Queue(CONTENT_QUEUE, { connection: redisConnection() }) }
export const contentJobOptions = { attempts: 3, backoff: { type: 'exponential', delay: 15000, jitter: 0.5 }, removeOnComplete: { age: 86400, count: 1000 }, removeOnFail: { age: 604800, count: 2000 } }
// DB outbox: submissions survive Redis outages and worker restarts. Redis only
// receives the durable job ID, not large briefs and website snapshots.
export async function dispatchContentJobs() {
  const pending = await prisma.contentJob.findMany({ where: { status: { in: ['QUEUED', 'RUNNING'] } }, orderBy: { createdAt: 'asc' }, take: 100, select: { id: true, kind: true, projectId: true, status: true } })
  for (const job of pending) {
    const targetQueue = job.kind === 'WEBSITE' ? generationQueue() : contentQueue()
    const existing = await targetQueue.getJob(job.id)
    if (existing && await existing.getState() === 'failed') {
      await prisma.contentJob.updateMany({ where: { id: job.id, status: { in: ['QUEUED', 'RUNNING'] } }, data: { status: 'FAILED', dedupeKey: null, finishedAt: new Date(), emailStatus: 'SKIPPED', error: 'The worker could not finish this request. Please retry.' } })
      if (job.kind === 'WEBSITE') await prisma.project.updateMany({ where: { id: job.projectId, status: 'GENERATING' }, data: { status: 'DRAFT' } })
      continue
    }
    if (existing) continue
    // A missing Redis record is recoverable from the durable database snapshot.
    if (job.kind === 'WEBSITE') await generationQueue().add('generate', { projectId: job.projectId, correlationId: job.id, contentJobId: job.id }, { ...contentJobOptions, jobId: job.id })
    else await contentQueue().add('content', { contentJobId: job.id }, { ...contentJobOptions, jobId: job.id })
  }
}
