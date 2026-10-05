import { fileURLToPath } from 'node:url'
import { config as loadEnv } from 'dotenv'

loadEnv({ path: fileURLToPath(new URL('../../../.env', import.meta.url)), override: true })
loadEnv()

const { Worker } = await import('bullmq')
const { GENERATION_QUEUE, redisConnection, runGeneration, generationQueue } = await import('@awb/pipeline')
const { env } = await import('@awb/shared')
const { CONTENT_QUEUE, contentQueue, dispatchContentJobs } = await import('@awb/pipeline/content-queue')
const { runContentJob } = await import('@awb/pipeline/content-worker')
const { deliverCompletionEmails } = await import('./completion-email')
const { dispatchMarketing } = await import('@awb/database/marketing')
const { deliverMarketingEmails } = await import('./marketing-email')

if (!env().USE_REDIS_QUEUE) {
  console.error('Enable USE_REDIS_QUEUE to process durable background jobs.')
  process.exit(1)
}

// Cluster-wide limits, not multiplied by the number of worker processes.
await generationQueue().setGlobalConcurrency(Number(process.env.WEBSITE_JOB_CONCURRENCY || 1))
await contentQueue().setGlobalConcurrency(Number(process.env.CONTENT_JOB_CONCURRENCY || 2))
await contentQueue().setGlobalRateLimit(Number(process.env.CONTENT_JOBS_PER_MINUTE || 12), 60000)

const worker = new Worker(
  GENERATION_QUEUE,
  async (job) => {
    console.log(`[worker] ${job.name} ${job.id} started`)
    if (job.data.contentJobId) return runContentJob(job.data.contentJobId, job.attemptsMade + 1 >= (job.opts.attempts ?? 3))
    const result = await runGeneration(job.data)
    console.log(`[worker] ${job.id} produced website version ${result.websiteVersionId}`)
    return result
  },
  {
    connection: redisConnection(),
    /// Generation is long-running and AI-bound, so a small concurrency keeps
    /// provider rate limits and database connections predictable.
    concurrency: Number(process.env['WORKER_CONCURRENCY'] ?? 1),
    lockDuration: 10 * 60 * 1000,
  },
)

const contentWorker = new Worker(CONTENT_QUEUE, (job) => runContentJob(job.data.contentJobId, job.attemptsMade + 1 >= (job.opts.attempts ?? 3)), { connection: redisConnection(), concurrency: Number(process.env.CONTENT_JOB_CONCURRENCY || 2), lockDuration: 120000, maxStalledCount: 2 })
let sweeping = false
const sweep = async () => {
  if (sweeping) return
  sweeping = true
  try { await dispatchContentJobs() }
  catch { console.error('[worker] Background dispatch temporarily unavailable; retrying.') }
  finally { sweeping = false }
}
const timer = setInterval(() => { void sweep() }, 15000)
void sweep()
let mailing = false
const mailTimer = setInterval(() => {
  if (mailing) return
  mailing = true
  void deliverCompletionEmails().catch(() => console.error('[worker] Email delivery temporarily unavailable.')).finally(() => { mailing = false })
}, 15000)
let marketing = false
const marketingTimer = setInterval(() => {
  if (marketing) return
  marketing = true
  void dispatchMarketing().then(() => deliverMarketingEmails()).catch(() => console.error('[worker] Marketing email processing delayed; retrying.')).finally(() => { marketing = false })
}, 15000)
let billing = false
const billingTimer = setInterval(() => {
  const base = process.env.PUBLIC_APP_URL || process.env.AUTH_URL
  const secret = process.env.BILLING_CRON_SECRET
  if (billing || !base || !secret) return
  billing = true
  void fetch(`${new URL(base).origin}/api/internal/billing/sync`, { method: 'POST', headers: { authorization: `Bearer ${secret}` }, signal: AbortSignal.timeout(90000) }).then(async response => {
    if (!response.ok) throw new Error('Billing reconciliation unavailable')
    const result = await response.json() as { failed?: number }
    if (result.failed) console.error('[worker] Some billing lifecycle checks need retry.')
  }).catch(() => console.error('[worker] Billing lifecycle check delayed; retrying.')).finally(() => { billing = false })
}, 60000)
for (const current of [worker, contentWorker]) {
  current.on('error', () => console.error('[worker] Queue connection interrupted; reconnecting.'))
  current.on('failed', (job) => {
    if (!job?.data.contentJobId) return
    void (async () => {
      if (await job.getState() !== 'failed') return
      const { prisma } = await import('@awb/database')
      const updated = await prisma.contentJob.updateMany({ where: { id: job.data.contentJobId, status: { in: ['QUEUED', 'RUNNING'] } }, data: { status: 'FAILED', dedupeKey: null, finishedAt: new Date(), error: 'The worker could not finish this request. Please retry.', emailStatus: 'SKIPPED' } })
      if (updated.count && job.data.projectId) await prisma.project.updateMany({ where: { id: job.data.projectId, status: 'GENERATING' }, data: { status: 'DRAFT' } })
    })().catch(() => console.error('[worker] Status update delayed; dispatcher will reconcile.'))
  })
}

worker.on('failed', (job, error) => {
  console.error(`[worker] job ${job?.id} failed:`, error.message)
})

worker.on('completed', (job) => {
  console.log(`[worker] job ${job.id} completed`)
})

console.log(`[worker] listening on queue "${GENERATION_QUEUE}" with AI provider "${env().AI_PROVIDER}"`)

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, async () => {
    console.log(`[worker] ${signal} received, draining`)
    clearInterval(timer)
    clearInterval(mailTimer)
    clearInterval(marketingTimer)
    clearInterval(billingTimer)
    await Promise.all([worker.close(), contentWorker.close()])
    process.exit(0)
  })
}
