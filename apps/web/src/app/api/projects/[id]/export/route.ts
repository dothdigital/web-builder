import { editingAccess } from '@/lib/billing/access'
import { WebsiteVersionKind, prisma } from '@awb/database'
import { websiteModelSchema } from '@awb/website-model'
import { resolvePreviewAssets } from '@/lib/preview-assets'
import { buildStaticExport, ExportAssetError } from '@/lib/static-export'
import { requireProject } from '@/lib/tenancy'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/// Exports the approved site as a self-contained static bundle. The published
/// version is used when one exists so a client never downloads unapproved work;
/// `?source=draft` is available for previewing the export of in-progress edits.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { project: accessProject } = await requireProject(id)
  if (!editingAccess(accessProject.workspace)) return Response.json({ error: 'Your trial has ended. Choose a plan to export.', billingUrl: '/billing' }, { status: 402 })

  const url = new URL(request.url)
  const wantsDraft = url.searchParams.get('source') === 'draft'

  const live = !wantsDraft ? await prisma.hostingSite.findUnique({ where: { projectId: id }, select: { deployedReleaseId: true } }) : null
  const liveRelease = live?.deployedReleaseId ? await prisma.publishRelease.findFirst({ where: { id: live.deployedReleaseId, projectId: id, status: 'LIVE' } }) : null
  const version = wantsDraft
    ? await prisma.websiteVersion.findFirst({ where: { projectId: id }, orderBy: { version: 'desc' } })
    : ((await prisma.websiteVersion.findFirst({
        where: { projectId: id, kind: WebsiteVersionKind.PUBLISHED },
        orderBy: { version: 'desc' },
      })) ??
      (await prisma.websiteVersion.findFirst({ where: { projectId: id }, orderBy: { version: 'desc' } })))

  if (!version) {
    return Response.json({ error: 'Nothing to export yet' }, { status: 404 })
  }

  const parsed = websiteModelSchema.safeParse(liveRelease?.snapshot ?? version.model)

  if (!parsed.success) {
    return Response.json({ error: 'Stored website model is invalid', issues: parsed.error.issues }, { status: 422 })
  }

  const project = await prisma.project.findUniqueOrThrow({ where: { id } })
  const domain = await prisma.domain.findFirst({ where: { projectId: id, isPrimary: true } })
  const siteUrl = parsed.data.site.primaryDomain ? `https://${parsed.data.site.primaryDomain}` : domain ? `https://${domain.hostname}` : `https://${project.previewHost}`

  let archive: Buffer
  try {
    const readableModel = await resolvePreviewAssets(id, parsed.data)
    const integration = await prisma.integration.findUnique({ where: { projectId: id } })
    archive = await buildStaticExport(readableModel, { siteUrl, forms: { projectId: id, action: `${url.origin}/api/leads`, ...(integration?.recaptchaEnabled && integration.recaptchaSiteKey ? { recaptchaSiteKey: integration.recaptchaSiteKey } : {}) } })
  } catch (error) {
    if (error instanceof ExportAssetError) return Response.json({ error: error.message }, { status: 502 })
    throw error
  }
  const filename = liveRelease ? `${project.slug}-site-r${liveRelease.releaseNumber}.zip` : `${project.slug}-site-v${version.version}.zip`

  return new Response(new Uint8Array(archive), {
    headers: {
      'content-type': 'application/zip',
      'content-disposition': `attachment; filename="${filename}"`,
      'cache-control': 'no-store',
    },
  })
}
