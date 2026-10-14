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
  return { id: job.id, kind: job.kind, result: job.result, pageId: input.pageId as string | undefined, insertIndex: input.insertIndex as number | undefined, sectionId: input.sectionId as string | undefined, originalSection: model?.pages?.find((page) => page.id === input.pageId)?.sections.find((section) => section.id === input.sectionId), originalPage: model?.pages?.find((page) => page.id === input.pageId) }
}
export async function dismissContentJob(id: string) {
  const job = await prisma.contentJob.findUniqueOrThrow({ where: { id } })
  await requireProject(job.projectId, WorkspaceRole.EDITOR)
  await prisma.contentJob.updateMany({ where: { id, status: { in: ['READY', 'FAILED'] } }, data: { status: 'DISMISSED', dedupeKey: null } })
}
export async function retryContentJob(id: string) {
  const job = await prisma.contentJob.findUniqueOrThrow({ where: { id } })
  await requireProject(job.projectId, WorkspaceRole.EDITOR)
  if (job.status !== 'FAILED') throw new Error('Only failed requests can be retried.')
  await submitContentJob(job.projectId, job.kind as 'COVER' | 'PATCH' | 'CREATE' | 'REWRITE' | 'SECTION' | 'WEBSITE', job.input)
  await prisma.contentJob.update({ where: { id }, data: { status: 'DISMISSED' } })
}

export async function createBlogCover(projectId: string, request: unknown) {
  return submitContentJob(projectId, 'COVER', request)
}
