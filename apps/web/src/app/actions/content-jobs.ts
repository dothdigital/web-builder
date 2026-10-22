'use server'
import { prisma, WorkspaceRole } from '@awb/database'
import { requireProject } from '@/lib/tenancy'
import { submitContentJob } from '@/lib/content-jobs'
export async function readContentResult(id: string) {
  const job = await prisma.contentJob.findUniqueOrThrow({ where: { id } })
  await requireProject(job.projectId, WorkspaceRole.EDITOR)
  if (job.status !== 'READY') throw new Error('This content is not ready yet.')
  const input = job.input as Record<string, unknown>
  const model = input.model as { pages?: Array<{ id: string; sections: Array<{ id: string }> }> } | undefined
  return { editorTarget: input.editorTarget, id: job.id, kind: job.kind, result: job.result, pageId: input.pageId as string | undefined, insertIndex: input.insertIndex as number | undefined, sectionId: input.sectionId as string | undefined, originalSection: model?.pages?.find((page) => page.id === input.pageId)?.sections.find((section) => section.id === input.sectionId), originalPage: model?.pages?.find((page) => page.id === input.pageId) }
}
export async function dismissContentJob(id: string) {
  const job = await prisma.contentJob.findUniqueOrThrow({ where: { id } })
  await requireProject(job.projectId, WorkspaceRole.EDITOR)
  await prisma.contentJob.updateMany({ where: { id, status: { in: ['READY', 'FAILED'] } }, data: { status: 'DISMISSED', dedupeKey: null } })
}
export async function retryContentJob(id: string) {
  const job = await prisma.contentJob.findUniqueOrThrow({ where: { id } })
  await requireProject(job.projectId, WorkspaceRole.EDITOR)
  if (job.kind === 'WEBSITE') { await resumeWebsiteBuild(job.projectId, id); return }
  if (job.status !== 'FAILED') throw new Error('Only failed requests can be retried.')
  await submitContentJob(job.projectId, job.kind as 'COVER' | 'PATCH' | 'CREATE' | 'REWRITE' | 'SECTION' | 'WEBSITE', job.input)
  await prisma.contentJob.update({ where: { id }, data: { status: 'DISMISSED' } })
}

export async function createBlogCover(projectId: string, request: unknown) {
  return submitContentJob(projectId, 'COVER', request)
}

// Keep the same content job ID so saved generation stages remain reusable.
export async function resumeWebsiteBuild(projectId: string, correlationId: string) {
  await requireProject(projectId, WorkspaceRole.EDITOR)
  const original = await prisma.contentJob.findFirst({ where: { id: correlationId, projectId, kind: 'WEBSITE' } })
  if (!original || !['FAILED', 'RUNNING', 'QUEUED'].includes(original.status)) throw new Error('This build cannot be resumed. Open the editor or start a new build.')
  if (await prisma.contentJob.findFirst({ where: { projectId, kind: 'WEBSITE', createdAt: { gt: original.createdAt } } })) throw new Error('A newer build exists. Open its progress from the dashboard.')
  const { generationQueue } = await import('@awb/pipeline')
  const queue = generationQueue()
  const queued = await queue.getJob(correlationId)
  if (queued) {
    const state = await queued.getState()
    if (state === 'active') throw new Error('This build is still running. If the worker stopped, it will release the build automatically; try again shortly.')
    if (['waiting', 'delayed', 'prioritized', 'waiting-children', 'paused'].includes(state)) return
    await queued.remove()
  }
  await prisma.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${projectId}))`
    const job = await tx.contentJob.findFirst({ where: { id: correlationId, projectId, kind: 'WEBSITE' } })
    if (!job || !['FAILED', 'RUNNING', 'QUEUED'].includes(job.status)) throw new Error('This build cannot be resumed. Open the editor or start a new build.')
    const newer = await tx.contentJob.findFirst({ where: { projectId, kind: 'WEBSITE', createdAt: { gt: job.createdAt } } })
    if (newer) throw new Error('A newer build exists. Open its progress from the dashboard.')
    await tx.contentJob.update({ where: { id: job.id }, data: { status: 'QUEUED', error: null, finishedAt: null, runToken: null, emailStatus: 'PENDING' } })
    await tx.generationJob.updateMany({ where: { projectId, correlationId, status: { not: 'SUCCEEDED' } }, data: { status: 'QUEUED', errorMessage: null, finishedAt: null } })
    await tx.project.update({ where: { id: projectId }, data: { status: 'GENERATING' } })
  })
  // The durable dispatcher adds this job back to Redis, even after an outage.
}
