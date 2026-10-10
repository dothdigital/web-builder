import { prisma, Prisma } from '@awb/database'
import { billingLifecycle } from '@awb/database/billing-policy'
import { websiteModelSchema, validateWebsiteModel } from '@awb/website-model'
import { validateSectionProps } from '@awb/component-registry'
import { resolvePreviewAssets } from '../preview-assets'
import { buildStaticExport } from '../static-export'
import { assertHostingConfigured } from './config'
import { agent, allocateServer, assignedServer, activateRoutes, releaseIsLive, checkPublicRelease, type RouteManifest } from './pool'
import { storeRelease, websiteStoragePrefix } from './storage'

// A separate agent namespace keeps draft deployments away from live routes.
export function previewSiteId(projectId: string) { return `${projectId}_preview` }

async function previewManifest(projectId: string, releaseId: string): Promise<RouteManifest> {
  const site = await prisma.hostingSite.findUniqueOrThrow({ where: { projectId }, include: { project: { include: { workspace: true } } } })
  if (!site.previewHost) throw new Error('Create a test URL before checking it.')
  return { projectId: previewSiteId(projectId), releaseId, hosts: [site.previewHost], primary: site.previewHost, suspended: !billingLifecycle(site.project.workspace).hosting, originUrl: assignedServer(site.serverId).originUrl, preview: true }
}

export async function syncPreview(projectId: string) {
  const site = await prisma.hostingSite.findUniqueOrThrow({ where: { projectId } })
  const releaseId = site.previewPendingReleaseId ?? site.previewDeployedReleaseId
  if (!site.serverId || !site.previewHost || !releaseId) return
  const server = assignedServer(site.serverId)
  const manifest = await previewManifest(projectId, releaseId)
  await activateRoutes(server, manifest)
  if (manifest.suspended) {
    await prisma.hostingSite.update({ where: { projectId }, data: { previewStatus: 'SUSPENDED' } })
    return
  }
  if (!await releaseIsLive(server, manifest.projectId, releaseId) || !await checkPublicRelease(site.previewHost, manifest.projectId, releaseId)) return
  if (site.previewPendingReleaseId) await prisma.$transaction([
    prisma.publishRelease.update({ where: { id: releaseId }, data: { status: 'LIVE', publishedAt: new Date() } }),
    prisma.hostingSite.update({ where: { projectId }, data: { previewDeployedReleaseId: releaseId, previewPendingReleaseId: null, previewStatus: 'READY', previewLastError: null } }),
  ])
  else await prisma.hostingSite.update({ where: { projectId }, data: { previewStatus: 'READY', previewLastError: null } })
}

export async function deployPreview(projectId: string, userId: string) {
  const config = assertHostingConfigured()
  const server = await allocateServer(projectId)
  let site = await prisma.hostingSite.findUniqueOrThrow({ where: { projectId } })
  if (site.previewPendingReleaseId) throw new Error('The previous test deployment is still running. Check status before updating the test URL.')
  const version = await prisma.websiteVersion.findFirst({ where: { projectId, kind: 'DRAFT' }, orderBy: { version: 'desc' } })
  if (!version) throw new Error('Save a generated website before creating a test URL.')
  const model = websiteModelSchema.parse(version.model)
  if (!validateWebsiteModel(model).valid) throw new Error('Fix the website validation errors before creating a test URL.')
  for (const page of model.pages) for (const section of page.sections) {
    if (!validateSectionProps(section.id, section.componentId, section.props).ok) throw new Error('Fix the invalid website sections before creating a test URL.')
  }
  const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId } })
  const host = site.previewHost ?? `test-${projectId}.${config.previewDomain}`
  const prefix = site.storagePrefix ?? websiteStoragePrefix(project.slug, projectId)
  site = await prisma.hostingSite.update({ where: { projectId }, data: { previewHost: host, storagePrefix: prefix } })
  model.site.primaryDomain = host
  const integration = await prisma.integration.findUnique({ where: { projectId } })
  const release = await prisma.$transaction(async (tx) => {
    const last = await tx.publishRelease.findFirst({ where: { projectId }, orderBy: { releaseNumber: 'desc' } })
    return tx.publishRelease.create({ data: { projectId, websiteVersionId: version.id, releaseNumber: (last?.releaseNumber ?? 0) + 1, isPreview: true, status: 'VALIDATING', publishedById: userId, snapshot: model as unknown as Prisma.InputJsonValue } })
  })
  let pending = false
  try {
    const readable = await resolvePreviewAssets(projectId, model)
    const archive = await buildStaticExport(readable, { siteUrl: `https://${host}`, preview: true, forms: { projectId, action: `${config.backend}/api/leads`, ...(integration?.recaptchaEnabled && integration.recaptchaSiteKey ? { recaptchaSiteKey: integration.recaptchaSiteKey } : {}) } })
    const storagePath = await storeRelease(`${prefix}-preview`, release.id, archive)
    await agent(server, `/sites/${previewSiteId(projectId)}/releases/${release.id}`, 'PUT', archive)
    await prisma.$transaction([
      prisma.publishRelease.update({ where: { id: release.id }, data: { status: 'DEPLOYING', validation: { storagePath, serverId: server.id } } }),
      prisma.hostingSite.update({ where: { projectId }, data: { previewPendingReleaseId: release.id, previewStatus: 'DEPLOYING', previewLastError: null } }),
    ])
    pending = true
    await syncPreview(projectId)
  } catch {
    if (!pending) await prisma.$transaction([
      prisma.publishRelease.update({ where: { id: release.id }, data: { status: 'FAILED' } }),
      prisma.hostingSite.update({ where: { projectId }, data: { previewStatus: site.previewDeployedReleaseId ? 'READY' : 'FAILED', previewLastError: 'Could not deploy this draft. Any previous test version is still available.' } }),
    ])
    throw new Error(pending ? 'Test deployment needs a status check. Use Check status to retry activation.' : 'Test deployment failed before activation. Check hosting setup and retry.')
  }
  const current = await prisma.hostingSite.findUniqueOrThrow({ where: { projectId } })
  return { url: `https://${host}`, ready: !current.previewPendingReleaseId && current.previewStatus === 'READY' }
}

export async function syncPreviewBilling(projectId: string) {
  const site = await prisma.hostingSite.findUnique({ where: { projectId } })
  if (!site?.serverId || !site.previewDeployedReleaseId) return
  const manifest = await previewManifest(projectId, site.previewDeployedReleaseId)
  await activateRoutes(assignedServer(site.serverId), manifest)
  await prisma.hostingSite.update({ where: { projectId }, data: { previewStatus: manifest.suspended ? 'SUSPENDED' : 'READY' } })
}
