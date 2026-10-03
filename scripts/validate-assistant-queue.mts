import { config } from 'dotenv'
config({ path: '.env', override: true, quiet: true })
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
const { prisma } = await import('@awb/database')
const { contentQueue, contentJobOptions } = await import('@awb/pipeline/content-queue')
const id = randomUUID()
const queue = contentQueue()
try {
 const project = await prisma.project.findFirstOrThrow({ select: { id: true, workspaceId: true } })
 await prisma.contentJob.create({ data: { id, projectId: project.id, workspaceId: project.workspaceId, requestedBy: 'assistant-validation', kind: 'PATCH', title: 'AI Assistant: validation (no website changes)', emailStatus: 'SKIPPED', input: { mode: 'PAGE_ASSISTANT', pageId: 'validation', instruction: 'Say hello and explain that you edit the current page.', context: { instruction: 'Say hello and explain that you edit the current page. Return explain, with no operations.', page: { id: 'validation', title: 'Test', sections: [] }, targets: [] } } } })
 await queue.add('content', { contentJobId: id }, { ...contentJobOptions, jobId: id })
 let last = ''
 const start = Date.now()
 while (Date.now() - start < 90000) {
  const job = await prisma.contentJob.findUniqueOrThrow({ where: { id } })
  if (last !== job.status) { last = job.status; console.log('Assistant queue:', last) }
  if (job.status === 'FAILED') throw new Error('Worker failed the assistant validation job')
  if (job.status === 'READY') {
   const result = job.result as { assistant?: boolean; plan?: { kind?: string } }
   assert.equal(result.assistant, true)
   assert.equal(result.plan?.kind, 'explain')
   console.log('PASS: running background worker processed and persisted an actual OpenAI assistant reply. No website edits or emails.')
   break
  }
  await new Promise(resolve => setTimeout(resolve, 1500))
 }
 assert.equal(last, 'READY', 'Worker did not finish within 90 seconds')
} catch (error) { console.error(error instanceof Error ? error.message.replace(/postgres(?:ql)?:\/\/[^\s]+/g, '[database]') : 'Queue validation failed'); process.exitCode = 1 } finally {
 const job = await queue.getJob(id)
 if (job && await job.getState() !== 'active') await job.remove()
 await prisma.contentJob.deleteMany({ where: { id } })
 await queue.close()
 await prisma.$disconnect()
 process.exit(process.exitCode ?? 0)
}
