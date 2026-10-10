import { randomUUID } from 'node:crypto'
import { prisma, Prisma } from '@awb/database'
import { websiteModelSchema, validateWebsiteModel } from '@awb/website-model'
import { validateSectionProps } from '@awb/component-registry'
import { resolvePreviewAssets } from '../preview-assets'
import { buildStaticExport } from '../static-export'
import { assertHostingConfigured } from './config'
import { checkDomainDns } from './dns'
import { ensureCustomHostname, validationRecords } from './cloudflare'
import { agent, allocateServer, assignedServer, activateRoutes, releaseIsLive, checkPublicRelease, type RouteManifest } from './pool'
import { storeRelease, websiteStoragePrefix } from './storage'
import { billingLifecycle } from '@awb/database/billing-policy'
import { syncPreviewBilling } from './preview'

export async function withHostingLock<T>(projectId: string, fn: () => Promise<T>) {
  await prisma.hostingSite.upsert({ where: { projectId }, create: { projectId }, update: {} })
  const token = randomUUID()
  const acquired = await prisma.hostingSite.updateMany({ where: { projectId, OR: [{ lockUntil: null }, { lockUntil: { lt: new Date() } }] }, data: { lockToken: token, lockUntil: new Date(Date.now() + 20 * 60000) } })
  if (!acquired.count) throw new Error('A publishing or domain check is already running. Please wait and refresh.')
  try { return await fn() } finally { await prisma.hostingSite.updateMany({ where: { projectId, lockToken: token }, data: { lockToken: null, lockUntil: null } }) }
}
export async function prepareSite(projectId: string) {
  assertHostingConfigured()
  await allocateServer(projectId)
  return prisma.hostingSite.findUniqueOrThrow({ where: { projectId } })
}
async function routeManifest(projectId: string, releaseId: string): Promise<RouteManifest> {
  const site = await prisma.hostingSite.findUniqueOrThrow({ where: { projectId }, include: { project: { include: { workspace: true, domains: true } } } })
  const release = await prisma.publishRelease.findUniqueOrThrow({ where: { id: releaseId } })
  const model = websiteModelSchema.parse(release.snapshot)
  const domains = site.project.domains.filter((domain) => domain.verifiedAt && domain.dnsReady && domain.sslStatus === 'active')
  const primary = model.site.primaryDomain ?? site.publicHost!
  const hosts = [...new Set([site.publicHost!, ...domains.map((domain) => domain.hostname)])]
  // Do not redirect visitors to a primary domain that is no longer connected.
  return { projectId, releaseId, hosts, primary: hosts.includes(primary) ? primary : site.publicHost!, suspended: !billingLifecycle(site.project.workspace).hosting, originUrl: assignedServer(site.serverId).originUrl }
}
export async function syncHosting(projectId: string) {
  const config = assertHostingConfigured()
  const site = await prisma.hostingSite.findUniqueOrThrow({ where: { projectId } })
  const domains = await prisma.domain.findMany({ where: { projectId }, orderBy: { hostname: 'asc' } })
  for (const domain of domains) {
    const dns = await checkDomainDns(domain.hostname, domain.verificationToken ?? '', config.cnameTarget)
    // Ownership is verified once. Routing and TLS are checked continuously.
    const owned = !!domain.verifiedAt || dns.ownership
    const host = owned ? await ensureCustomHostname(domain.hostname, domain.cloudflareHostnameId) : null
    const ready = host?.status === 'active' && host.ssl?.status === 'active'
    const routing = dns.routing || !!ready // Cloudflare validates activation even when DNS is flattened/proxied.
    await prisma.domain.update({ where: { id: domain.id }, data: {
      verifiedAt: owned ? domain.verifiedAt ?? new Date() : null, dnsReady: routing,
      cloudflareHostnameId: host?.id ?? domain.cloudflareHostnameId,
      cloudflareValidation: host ? validationRecords(host) as unknown as Prisma.InputJsonValue : undefined,
      sslStatus: host?.ssl?.status ?? 'pending', lastCheckedAt: new Date(), status: 'VERIFYING',
      lastError: !owned ? 'Ownership TXT record not found yet.' : !routing ? 'Point your domain to the hosting target shown below.' : !ready ? 'Complete the Cloudflare verification records below while HTTPS is prepared.' : null,
    } })
  }
  if (!site.serverId || !site.publicHost) return
  const releaseId = site.pendingReleaseId ?? site.deployedReleaseId
  if (!releaseId) return
  const server = assignedServer(site.serverId)
  const manifest = await routeManifest(projectId, releaseId)
  // Retry an interrupted activation with the same immutable release.
  await activateRoutes(server, manifest)
  if (!await releaseIsLive(server, projectId, releaseId)) return
  const checkHost = manifest.primary
  if (manifest.suspended || !await checkPublicRelease(checkHost, projectId, releaseId)) return
  if (site.pendingReleaseId) await prisma.$transaction([
    prisma.publishRelease.update({ where: { id: releaseId }, data: { status: 'LIVE', publishedAt: new Date() } }),
    prisma.hostingSite.update({ where: { projectId }, data: { deployedReleaseId: releaseId, pendingReleaseId: null, status: 'LIVE', lastError: null, billingGateApplied: manifest.suspended } }),
    prisma.project.update({ where: { id: projectId }, data: { status: 'PUBLISHED' } }),
  ])
  else await prisma.hostingSite.update({ where: { projectId }, data: { status: 'LIVE', lastError: null } })
  for (const domain of domains) {
    const current = await prisma.domain.findUniqueOrThrow({ where: { id: domain.id } })
    if (current.verifiedAt && current.dnsReady && current.sslStatus === 'active' && await checkPublicRelease(current.hostname, projectId, releaseId)) {
      await prisma.domain.update({ where: { id: current.id }, data: { status: 'ACTIVE', lastError: null } })
    }
  }
}
export async function publishSite(projectId: string, userId: string) {
  const config = assertHostingConfigured()
  const site = await prepareSite(projectId)
  if (site.pendingReleaseId) throw new Error('The previous release is still deploying. Check status before publishing again.')
  await syncHosting(projectId)
  const version = await prisma.websiteVersion.findFirst({ where: { projectId, kind: 'DRAFT' }, orderBy: { version: 'desc' } })
  if (!version) throw new Error('Save a generated website before publishing.')
  const model = websiteModelSchema.parse(version.model)
  if (!validateWebsiteModel(model).valid) throw new Error('Fix the website validation errors before publishing.')
  for (const page of model.pages) for (const section of page.sections) {
    if (!validateSectionProps(section.id, section.componentId, section.props).ok) throw new Error('Fix the invalid website sections before publishing.')
  }
  const primary = await prisma.domain.findFirst({ where: { projectId, isPrimary: true } })
  if (primary && (!primary.verifiedAt || !primary.dnsReady || primary.sslStatus !== 'active')) throw new Error('Complete ownership, routing and HTTPS verification for the primary domain first, or select the temporary address.')
  const canonical = primary?.hostname ?? site.publicHost!
  model.site.primaryDomain = canonical
  const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId } })
  const prefix = site.storagePrefix ?? websiteStoragePrefix(project.slug, projectId)
  if (!site.storagePrefix) await prisma.hostingSite.update({ where: { projectId }, data: { storagePrefix: prefix } })
  const integration = await prisma.integration.findUnique({ where: { projectId } })
  const release = await prisma.$transaction(async (tx) => {
    const last = await tx.publishRelease.findFirst({ where: { projectId }, orderBy: { releaseNumber: 'desc' } })
    return tx.publishRelease.create({ data: { projectId, websiteVersionId: version.id, releaseNumber: (last?.releaseNumber ?? 0) + 1, status: 'VALIDATING', publishedById: userId, snapshot: model as unknown as Prisma.InputJsonValue } })
  })
  let pending = false
  try {
    const readable = await resolvePreviewAssets(projectId, model)
    const archive = await buildStaticExport(readable, { siteUrl: `https://${canonical}`, forms: { projectId, action: `${config.backend}/api/leads`, ...(integration?.recaptchaEnabled && integration.recaptchaSiteKey ? { recaptchaSiteKey: integration.recaptchaSiteKey } : {}) } })
    const storagePath = await storeRelease(prefix, release.id, archive)
    const server = assignedServer(site.serverId)
    await agent(server, `/sites/${projectId}/releases/${release.id}`, 'PUT', archive)
    await prisma.$transaction([
      prisma.publishRelease.update({ where: { id: release.id }, data: { status: 'DEPLOYING', validation: { storagePath, serverId: server.id } } }),
      prisma.hostingSite.update({ where: { projectId }, data: { pendingReleaseId: release.id, status: 'DEPLOYING', lastError: null } }),
    ])
    pending = true
    await syncHosting(projectId)
  } catch {
    if (!pending) await prisma.$transaction([
      prisma.publishRelease.update({ where: { id: release.id }, data: { status: 'FAILED' } }),
      prisma.hostingSite.update({ where: { projectId }, data: { lastError: 'Could not prepare or upload the release. The previous published version is unchanged.' } }),
    ])
    throw new Error(pending ? 'Publishing needs a status check. Use Check status; activation will retry automatically.' : 'Publishing failed before activation. Check hosting setup and retry.')
  }
  return release.id
}
export async function syncBillingHosting(projectId: string) {
  await syncPreviewBilling(projectId)
  const site = await prisma.hostingSite.findUnique({ where: { projectId }, include: { project: { include: { workspace: true } } } })
  if (!site?.serverId || !site.deployedReleaseId) return
  const suspended = !billingLifecycle(site.project.workspace).hosting
  if (suspended === site.billingGateApplied) return
  await activateRoutes(assignedServer(site.serverId), await routeManifest(projectId, site.deployedReleaseId))
  await prisma.hostingSite.update({ where: { projectId }, data: { billingGateApplied: suspended } })
  await prisma.auditEvent.create({ data: { workspaceId: site.project.workspaceId, action: suspended ? 'billing.hosting.suspend' : 'billing.hosting.restore', targetType: 'Project', targetId: projectId } })
}
