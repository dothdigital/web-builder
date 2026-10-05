import { OpenAiProvider, createAiProvider } from '@awb/ai'
import { canGenerate } from './billing-access'
import { randomUUID } from 'node:crypto'
import { prisma, Prisma } from '@awb/database'
import { patchContentSection, generateAiSection, rewritePageWithAi, createContentWithAi } from './content-generation'
import { generateBlogCover } from './blog-cover'
import { runGeneration } from './run'
const json = (value: unknown) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue
export async function runContentJob(id: string, finalAttempt: boolean) {
  const job = await prisma.contentJob.findUniqueOrThrow({ where: { id } })
  if (['READY', 'APPLIED', 'DISMISSED'].includes(job.status)) return job.result
  if (!await canGenerate(job.projectId, id)) {
    await prisma.contentJob.updateMany({ where: { id, status: { in: ['QUEUED', 'RUNNING'] } }, data: { status: 'FAILED', dedupeKey: null, finishedAt: new Date(), emailStatus: 'SKIPPED', error: 'Payment is required before AI generation. Open Plans & billing to continue.' } })
    if (job.kind === 'WEBSITE') await prisma.project.updateMany({ where: { id: job.projectId, status: 'GENERATING' }, data: { status: 'DRAFT' } })
    return
  }
  const token = randomUUID()
  const claimed = await prisma.contentJob.updateMany({ where: { id, status: { in: ['QUEUED', 'RUNNING'] } }, data: { status: 'RUNNING', runToken: token, startedAt: new Date(), attempts: { increment: 1 }, error: null } })
  if (!claimed.count) return
  try {
    const input = job.input as unknown as Parameters<typeof patchContentSection>[1] & Parameters<typeof generateAiSection>[1] & Parameters<typeof rewritePageWithAi>[1] & Parameters<typeof createContentWithAi>[1]
    const assistantInput = job.input as Record<string, unknown>
    const assistant = job.kind === 'PATCH' && assistantInput.mode === 'PAGE_ASSISTANT'
    const planAssistant = async () => {
      const provider = createAiProvider()
      if (!(provider instanceof OpenAiProvider)) throw new Error('OpenAI must be configured for the editor assistant')
      const result = await provider.planEditorCommand(assistantInput.context)
      return { assistant: true, plan: result.data }
    }
    const result = assistant ? await planAssistant() : job.kind === 'COVER' ? await generateBlogCover(job.projectId, job.input, job.id) : job.kind === 'WEBSITE' ? await runGeneration({ projectId: job.projectId, correlationId: job.id, contentJobId: job.id }) : job.kind === 'PATCH' ? await patchContentSection(job.projectId, input) : job.kind === 'CREATE' ? await createContentWithAi(job.projectId, input) : job.kind === 'REWRITE' ? await rewritePageWithAi(job.projectId, input) : await generateAiSection(job.projectId, input)
    await prisma.contentJob.updateMany({ where: { id, runToken: token, status: 'RUNNING' }, data: { status: 'READY', ...(job.kind === 'WEBSITE' ? { dedupeKey: null } : {}), result: json(result), finishedAt: new Date(), error: null } })
    return result
  } catch {
    // Provider errors may contain request details. Expose only a safe message.
    await prisma.contentJob.updateMany({ where: { id, runToken: token }, data: { status: finalAttempt ? 'FAILED' : 'QUEUED', error: finalAttempt ? 'Generation could not finish after retries. Please try again.' : 'Temporarily delayed; retrying automatically.', ...(finalAttempt ? { finishedAt: new Date(), dedupeKey: null, emailStatus: 'SKIPPED' } : {}) } })
    throw new Error('Content generation failed')
  }
}
