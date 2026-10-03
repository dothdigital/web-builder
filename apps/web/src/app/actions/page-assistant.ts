'use server'

import { z } from 'zod'
import { assistantPlanSchema } from '@awb/ai/editor-command'
import { WorkspaceRole, prisma } from '@awb/database'
import { websiteModelSchema } from '@awb/website-model'
import { requireProject } from '@/lib/tenancy'
import { submitContentJob } from '@/lib/content-jobs'
import { assistantTargets, themeButtonColors, editorCompatiblePlan } from '@/lib/page-assistant'

const selectionSchema = z.object({ sectionId: z.string().max(200), paths: z.array(z.string().max(500)).max(50), scope: z.enum(['page', 'header', 'footer']) })
export async function queuePageAssistant(projectId: string, raw: unknown) {
  const { project } = await requireProject(projectId, WorkspaceRole.EDITOR)
  const input = z.object({ model: websiteModelSchema, pageId: z.string(), instruction: z.string().trim().min(1).max(4000), selection: selectionSchema.optional(), history: z.array(z.object({ role: z.enum(['user', 'assistant']), text: z.string().max(4000) })).max(12).default([]), imageUrl: z.string().max(4000).default('') }).parse(raw)
  const page = input.model.pages.find(page => page.id === input.pageId)
  if (!page) throw new Error('Page not found.')
  const assets = await prisma.asset.findMany({ where: { projectId, kind: { in: ['IMAGE', 'LOGO'] } }, select: { url: true, altText: true }, take: 60, orderBy: { createdAt: 'desc' } })
  const business = await prisma.businessProfile.findUnique({ where: { projectId } })
  const catalogue = assistantTargets(input.model, input.pageId)
  if (catalogue.length > 1500) throw new Error('This page is too large for one assistant request. Use section-level AI editing.')
  const scrub = (value: unknown): unknown => Array.isArray(value) ? value.map(scrub) : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).filter(([key]) => !/secret|token|apiKey|script|^html$|^css$/i.test(key)).map(([key, entry]) => [key, scrub(entry)])) : value
  const context = { website: project.name, theme: { buttons: themeButtonColors(input.model) }, business: scrub(business), page: scrub(page), shared: scrub(input.model.globalComponents), pages: input.model.pages.map(({ path, title }) => ({ path, title })), targets: catalogue, selection: input.selection, assets, attachedImage: input.imageUrl, history: input.history, instruction: input.instruction }
  if (JSON.stringify(context).length > 180000) throw new Error('This page contains too much content for one assistant request. Try section-level AI editing.')
  return submitContentJob(projectId, 'PATCH', { ...input, mode: 'PAGE_ASSISTANT', context })
}

export async function readPageAssistantJobs(projectId: string, pageId: string) {
  const { user } = await requireProject(projectId, WorkspaceRole.EDITOR)
  const jobs = await prisma.contentJob.findMany({ where: { projectId, requestedBy: user.id, kind: 'PATCH', AND: [{ input: { path: ['mode'], equals: 'PAGE_ASSISTANT' } }, { input: { path: ['pageId'], equals: pageId } }], status: { in: ['QUEUED', 'RUNNING', 'READY', 'FAILED'] } }, orderBy: { createdAt: 'asc' }, take: 10 })
  return jobs.map(job => {
    const input = job.input as Record<string, unknown>
    const model = input.model as z.infer<typeof websiteModelSchema>
    const result = job.result as { plan?: unknown } | null
    const plan = assistantPlanSchema.safeParse(result?.plan)
    const compatibleResult = plan.success ? { ...result, plan: editorCompatiblePlan(plan.data, model) } : job.result
    return { id: job.id, status: job.status, error: job.error, result: compatibleResult, instruction: String(input.instruction), selection: input.selection as z.infer<typeof selectionSchema> | undefined, originalPage: model.pages.find(page => page.id === pageId), originalGlobals: model.globalComponents }
  })
}
export async function finishPageAssistantJob(projectId: string, id: string) {
  const { user } = await requireProject(projectId, WorkspaceRole.EDITOR)
  await prisma.contentJob.updateMany({ where: { id, projectId, requestedBy: user.id, kind: 'PATCH', status: 'READY', input: { path: ['mode'], equals: 'PAGE_ASSISTANT' } }, data: { status: 'APPLIED', dedupeKey: null } })
}
