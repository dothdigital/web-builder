'use server'

import { getAtPointer } from '@awb/pipeline/json-pointer'
import { editorImageTargetSchema } from '@awb/shared/image-direction'
import { revalidatePath } from 'next/cache'
import { WorkspaceRole, prisma } from '@awb/database'
import { validateSectionProps } from '@awb/component-registry'
import { validateWebsiteModel, websiteModelSchema, type WebsiteModel } from '@awb/website-model'
import { requireProject } from '@/lib/tenancy'
import { saveDraftModel } from '@/lib/website'
import { paidAccess } from '@/lib/billing/access'
import { submitContentJob } from '@/lib/content-jobs'

function assertRenderable(model: WebsiteModel): void {
  const result = validateWebsiteModel(model)

  if (!result.valid) {
    throw new Error(result.issues.map((issue) => issue.message).join('; '))
  }

  for (const page of model.pages) {
    for (const section of page.sections) {
      const sectionResult = validateSectionProps(section.id, section.componentId, section.props)

      if (!sectionResult.ok) {
        throw new Error(`${section.componentId}: ${sectionResult.error.message}`)
      }
    }
  }
}

export async function saveModel(projectId: string, model: unknown, note = 'Editor change'): Promise<{ testLinkQueued: boolean }> {
  const { user, project } = await requireProject(projectId, WorkspaceRole.EDITOR)

  const parsed = websiteModelSchema.parse(model)
  assertRenderable(parsed)

  const saved = await saveDraftModel(projectId, parsed, note, user.isPlatformAdmin || user.isPlatformSupport ? user.id : undefined, paidAccess(project.workspace) && (!user.isPlatformSupport || user.isPlatformAdmin) ? user.id : undefined)
  const ready = await prisma.contentJob.findMany({ where: { projectId, status: 'READY', kind: { not: 'WEBSITE' } } })
  for (const job of ready) {
    const output = job.result as Record<string, unknown> | null
    const generatedPage = output?.page as WebsiteModel['pages'][number] | undefined
    const target = editorImageTargetSchema.safeParse((job.input as Record<string, unknown> | null)?.editorTarget)
    let imageIncluded = false
    if (job.kind === 'COVER' && target.success && typeof output?.url === 'string') {
      const pageIndex = parsed.pages.findIndex(page => page.id === target.data.pageId)
      const sectionIndex = parsed.pages[pageIndex]?.sections.findIndex(section => section.id === target.data.sectionId) ?? -1
      const root = target.data.globalSlot ? `/globalComponents/${target.data.globalSlot}/props` : pageIndex >= 0 && sectionIndex >= 0 ? `/pages/${pageIndex}/sections/${sectionIndex}/props` : undefined
      imageIncluded = Boolean(root && getAtPointer(parsed, root + target.data.pointer) === output.url)
    }
    const included = imageIncluded || (job.kind === 'PATCH' ? parsed.pages.some((page) => page.sections.some((section) => JSON.stringify(section) === JSON.stringify(output))) : job.kind === 'SECTION' ? parsed.pages.some((page) => page.sections.some((section) => section.id === output?.id)) : generatedPage && parsed.pages.some((page) => page.id === generatedPage.id && (job.kind === 'CREATE' || JSON.stringify(page) === JSON.stringify(generatedPage))))
    if (included) await prisma.contentJob.updateMany({ where: { id: job.id, status: 'READY' }, data: { status: 'APPLIED', dedupeKey: null } })
  }

  revalidatePath(`/projects/${projectId}/editor`)
  revalidatePath(`/preview/${projectId}`)
  revalidatePath('/dashboard')
  return saved
}

export async function askAiForSection(projectId: string, input: { model: unknown; pageId: string; sectionId: string; instruction: string }) {
  return submitContentJob(projectId, 'PATCH', input)
}

/// Return a single generated section for review in the current editor draft.
/// The client merges it into its latest history so unsaved edits are preserved.
export async function generateAiSection(projectId: string, input: { model: unknown; pageId: string; componentId: string; instruction: string; insertIndex?: number }) {
  return submitContentJob(projectId, 'SECTION', input)
}
export async function rewritePageWithAi(projectId: string, input: { model: unknown; pageId: string; instruction: string }) {
  return submitContentJob(projectId, 'REWRITE', input)
}
export async function createContentWithAi(projectId: string, input: { model: unknown; request: unknown }) {
  return submitContentJob(projectId, 'CREATE', input)
}
