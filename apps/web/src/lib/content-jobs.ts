import { createHash, randomUUID } from 'node:crypto'
import { WorkspaceRole, prisma, Prisma } from '@awb/database'
import { createAiProvider } from '@awb/ai'
import { websiteModelSchema } from '@awb/website-model'
import { requireProject } from './tenancy'
import { blogCoverRequestSchema, contentRequestSchema, validateContentRequest } from './content-creation'

export async function submitContentJob(projectId: string, kind: 'COVER' | 'PATCH' | 'SECTION' | 'REWRITE' | 'CREATE' | 'WEBSITE', raw: unknown) {
  const { user, project } = await requireProject(projectId, WorkspaceRole.EDITOR)
  createAiProvider()
  const input = raw as Record<string, unknown>
  let title = `Website: ${project.name}`
  if (kind === 'COVER') {
    const request = blogCoverRequestSchema.parse(raw)
    if (createAiProvider().name !== 'openai') throw new Error('AI cover images require OpenAI to be configured.')
    title = `Blog cover: ${request.topic}`
  } else if (kind !== 'WEBSITE') {
    const model = websiteModelSchema.parse(input.model)
    if (kind === 'CREATE') {
      const request = contentRequestSchema.parse(input.request)
      if (request.kind === 'blog' && !request.coverImageUrl) throw new Error('Choose a blog cover image first.')
      validateContentRequest(model, request)
      title = `${request.kind === 'blog' ? 'Blog' : 'Page'}: ${request.topic}`
    } else {
      const page = model.pages.find((entry) => entry.id === input.pageId)
      if (!page) throw new Error('Page not found')
      if (typeof input.instruction !== 'string' || input.instruction.length > 4000 || ['REWRITE', 'PATCH'].includes(kind) && !input.instruction.trim()) throw new Error('Enter instructions under 4,000 characters.')
      if (kind === 'PATCH' && input.mode !== 'PAGE_ASSISTANT' && !page.sections.some((section) => section.id === input.sectionId)) throw new Error('Section not found')
      title = input.mode === 'PAGE_ASSISTANT' ? `AI Assistant: ${page.title}` : `${kind === 'SECTION' ? 'Section' : 'Rewrite'}: ${page.title}`
    }
  }
  const serialized = JSON.stringify(input)
  if (serialized.length > 5_000_000) throw new Error('This website is too large for one content request.')
  const dedupeKey = createHash('sha256').update(`${projectId}:${kind}:${serialized}`).digest('hex')
  const job = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${project.workspaceId}))`
    const existing = await tx.contentJob.findUnique({ where: { dedupeKey } })
    if (existing) return existing
    if (input.mode === 'PAGE_ASSISTANT') {
      const pending = await tx.contentJob.findFirst({ where: { projectId, requestedBy: user.id, kind: 'PATCH', status: { in: ['QUEUED', 'RUNNING', 'READY'] }, AND: [{ input: { path: ['mode'], equals: 'PAGE_ASSISTANT' } }, { input: { path: ['pageId'], equals: String(input.pageId) } }] } })
      if (pending) throw new Error('Finish or dismiss the existing assistant request for this page before sending another.')
    }
    const active = await tx.contentJob.count({ where: { workspaceId: project.workspaceId, status: { in: ['QUEUED', 'RUNNING'] } } })
    const legacy = await tx.project.count({ where: { workspaceId: project.workspaceId, ...(kind === 'WEBSITE' ? { id: { not: projectId } } : {}), status: 'GENERATING', contentJobs: { none: { status: { in: ['QUEUED', 'RUNNING'] } } } } })
    if (active + legacy >= 3) throw new Error('Three requests are already queued or running in this workspace. Please wait for one to finish.')
    return tx.contentJob.create({ data: { id: randomUUID(), projectId, workspaceId: project.workspaceId, requestedBy: user.id, kind, title: title.slice(0, 250), input: JSON.parse(serialized) as Prisma.InputJsonValue, dedupeKey, emailTo: user.email, ...(input.mode === 'PAGE_ASSISTANT' ? { emailStatus: 'SKIPPED' as const } : {}) } })
  })
  return { jobId: job.id, status: job.status }
}
