import { randomUUID } from 'node:crypto'
import { prisma, Prisma } from '@awb/database'
import { websiteModelSchema } from '@awb/website-model'
import { validateWebsiteModel } from '@awb/website-model'
import { validateSectionProps } from '@awb/component-registry'
import { resolvePreviewAssets } from '../preview-assets'
import { buildStaticExport } from '../static-export'
import { assertHostingConfigured } from './config'
import { checkDomainDns } from './dns'
import * as aws from './aws'
import { billingLifecycle } from '@awb/database/billing-policy'

export async function withHostingLock<T>(projectId: string, fn: () => Promise<T>) {
  await prisma.hostingSite.upsert({ where: { projectId }, create: { projectId }, update: {} })
  const token = randomUUID()
  const acquired = await prisma.hostingSite.updateMany({ where: { projectId, OR: [{ lockUntil: null }, { lockUntil: { lt: new Date() } }] }, data: { lockToken: token, lockUntil: new Date(Date.now() + 20 * 60000) } })
  if (!acquired.count) throw new Error('A publishing or domain check is already running. Please wait and refresh.')
  try { return await fn() } finally { await prisma.hostingSite.updateMany({ where: { projectId, lockToken: token }, data: { lockToken: null, lockUntil: null } }) }
}
export async function prepareSite(projectId: string) {
  assertHostingConfigured()
  const site = await prisma.hostingSite.findUniqueOrThrow({ where: { projectId } })
  if (site.distributionId) return site
  const distribution = await aws.ensureDistribution(projectId)
  return prisma.hostingSite.update({ where: { projectId }, data: { distributionId: distribution.id, distributionHost: distribution.hostname, status: 'PROVISIONING', lastError: null } })
}
export async function syncHosting(projectId: string) {
  assertHostingConfigured()
  const site = await prisma.hostingSite.findUniqueOrThrow({ where: { projectId } })
  const domains = await prisma.domain.findMany({ where: { projectId }, orderBy: { hostname: 'asc' } })
  for (const domain of domains) {
    const check = await checkDomainDns(domain.hostname, domain.verificationToken ?? '', site.distributionHost)
    await prisma.domain.update({ where: { id: domain.id }, data: { verifiedAt: check.ownership ? domain.verifiedAt ?? new Date() : null, dnsReady: check.routing, lastCheckedAt: new Date(), status: check.ownership ? 'VERIFYING' : 'PENDING', lastError: check.ownership ? check.routing ? null : 'Point the domain to the CloudFront target shown below.' : 'Ownership TXT record not found yet.' } })
  }
  const verified = await prisma.domain.findMany({ where: { projectId, verifiedAt: { not: null } }, orderBy: { hostname: 'asc' } })
  let certificateArn = site.certificateArn
  if (verified.length) {
    certificateArn = await aws.ensureCertificate(projectId, verified.map((domain) => domain.hostname), certificateArn)
    await prisma.hostingSite.update({ where: { projectId }, data: { certificateArn } })
    const cert = await aws.certificateDetails(certificateArn)
    await prisma.domain.updateMany({ where: { id: { in: verified.map((domain) => domain.id) } }, data: { sslStatus: cert?.Status === 'ISSUED' ? 'issued' : cert?.Status === 'FAILED' ? 'failed' : 'pending' } })
  }
  if (!site.distributionId) return
  const distribution = await aws.distributionDetails(site.distributionId)
  if (distribution?.Status !== 'Deployed') return
  if (site.status === 'PROVISIONING') await prisma.hostingSite.update({ where: { projectId }, data: { status: 'READY' } })
  const aliases = distribution.DistributionConfig?.Aliases?.Items ?? []
  await prisma.domain.updateMany({ where: { projectId, hostname: { in: aliases }, dnsReady: true, verifiedAt: { not: null }, sslStatus: 'issued' }, data: { status: 'ACTIVE', sslStatus: 'active', lastError: null } })
  if (site.pendingReleaseId) {
    const release = await prisma.publishRelease.findUniqueOrThrow({ where: { id: site.pendingReleaseId } })
    const expected = `/${aws.releasePrefix(projectId, release.id)}`
    if (distribution.DistributionConfig?.Origins?.Items?.[0]?.OriginPath !== expected) {
      if (Date.now() - release.createdAt.getTime() > 20 * 60000) {
        await prisma.$transaction([
          prisma.publishRelease.update({ where: { id: release.id }, data: { status: 'FAILED' } }),
          prisma.hostingSite.update({ where: { projectId }, data: { pendingReleaseId: null, status: site.deployedReleaseId ? 'LIVE' : 'READY', lastError: 'Deployment did not activate. The previous published version is unchanged. You can retry publishing.' } }),
        ])
      }
      return
    }
    let invalidationId = (release.validation as { invalidationId?: string } | null)?.invalidationId
    if (!invalidationId) {
      invalidationId = await aws.ensureInvalidation(site.distributionId, release.id)
      await prisma.publishRelease.update({ where: { id: release.id }, data: { validation: { invalidationId } } })
    }
    if (!await aws.invalidationComplete(site.distributionId, invalidationId)) return
    await prisma.$transaction([
      prisma.publishRelease.update({ where: { id: release.id }, data: { status: 'LIVE', publishedAt: new Date() } }),
      prisma.hostingSite.update({ where: { projectId }, data: { deployedReleaseId: release.id, pendingReleaseId: null, status: 'LIVE', lastError: null } }),
      prisma.project.update({ where: { id: projectId }, data: { status: 'PUBLISHED' } }),
    ])
    if (site.deployedReleaseId && site.deployedReleaseId !== release.id) { try { await aws.deleteReleaseFunction(projectId, site.deployedReleaseId) } catch { /* An operator can clean up a detached function later; live release stays valid. */ } }
  }
}
export async function publishSite(projectId: string, userId: string) {
  const settings = assertHostingConfigured()
  await syncHosting(projectId)
  const site = await prepareSite(projectId)
  if ((await aws.distributionDetails(site.distributionId!))?.Status !== 'Deployed') throw new Error('AWS deployment needs a few minutes to prepare the hosting address. Check status, then publish again.')
  if (site.pendingReleaseId) throw new Error('The previous release is still deploying. Wait for it to finish before publishing again.')
  const version = await prisma.websiteVersion.findFirst({ where: { projectId, kind: 'DRAFT' }, orderBy: { version: 'desc' } })
  if (!version) throw new Error('Save a generated website before publishing.')
  const model = websiteModelSchema.parse(version.model)
  const valid = validateWebsiteModel(model)
  if (!valid.valid) throw new Error('Fix the website validation errors before publishing.')
  for (const page of model.pages) for (const section of page.sections) {
    const checked = validateSectionProps(section.id, section.componentId, section.props)
    if (!checked.ok) throw new Error(`Fix the invalid ${section.componentId} section before publishing.`)
  }
  const domains = await prisma.domain.findMany({ where: { projectId }, orderBy: { hostname: 'asc' } })
  const primary = domains.find((domain) => domain.isPrimary)
  if (primary && (!primary.verifiedAt || !primary.dnsReady || !['issued', 'active'].includes(primary.sslStatus))) throw new Error('Complete ownership, routing and HTTPS certificate verification for the primary domain first. You can deselect it to publish to the temporary address.')
  const hosts = domains.filter((domain) => domain.verifiedAt && domain.dnsReady && ['issued', 'active'].includes(domain.sslStatus)).map((domain) => domain.hostname)
  if (hosts.length && (!site.certificateArn || (await aws.certificateDetails(site.certificateArn))?.Status !== 'ISSUED')) throw new Error('Complete ownership and HTTPS certificate validation before publishing custom domains.')
  const integration = await prisma.integration.findUnique({ where: { projectId } })
  const canonical = primary?.hostname ?? site.distributionHost!
  model.site.primaryDomain = canonical
  const release = await prisma.$transaction(async (tx) => {
    const last = await tx.publishRelease.findFirst({ where: { projectId }, orderBy: { releaseNumber: 'desc' } })
    return tx.publishRelease.create({ data: { projectId, websiteVersionId: version.id, releaseNumber: (last?.releaseNumber ?? 0) + 1, status: 'VALIDATING', publishedById: userId, snapshot: model as unknown as Prisma.InputJsonValue } })
  })
  let activationStarted = false
  try {
    const readable = await resolvePreviewAssets(projectId, model)
    const archive = await buildStaticExport(readable, { siteUrl: `https://${canonical}`, forms: { projectId, action: `${settings.backend}/api/leads`, ...(integration?.recaptchaEnabled && integration.recaptchaSiteKey ? { recaptchaSiteKey: integration.recaptchaSiteKey } : {}) } })
    await aws.uploadRelease(projectId, release.id, archive)
    const functionArn = await aws.ensureRoutingFunction(projectId, release.id, primary?.hostname)
    await prisma.$transaction([
      prisma.publishRelease.update({ where: { id: release.id }, data: { status: 'DEPLOYING' } }),
      prisma.hostingSite.update({ where: { projectId }, data: { pendingReleaseId: release.id, functionArn, status: 'DEPLOYING', lastError: null } }),
    ])
    activationStarted = true
    await aws.activateRelease({ distributionId: site.distributionId!, projectId, releaseId: release.id, functionArn, hosts, certificateArn: site.certificateArn })
  } catch {
    if (!activationStarted) {
      await prisma.publishRelease.update({ where: { id: release.id }, data: { status: 'FAILED' } })
      await prisma.hostingSite.update({ where: { projectId }, data: { lastError: 'The release could not be prepared or uploaded. The previous published files are unchanged.' } })
    }
    throw new Error(activationStarted ? 'AWS deployment needs a status check. Use Check status before retrying; the deployment may still complete.' : 'Publishing failed before activation. Check the AWS setup and try again.')
  }
  return release.id
}

export async function syncBillingHosting(projectId: string) {
  const site = await prisma.hostingSite.findUnique({ where: { projectId }, include: { project: { include: { workspace: true } } } })
  if (!site?.distributionId) return
  const suspended = !billingLifecycle(site.project.workspace).hosting
  if (suspended === site.billingGateApplied) return
  assertHostingConfigured()
  await aws.setBillingGate({ projectId, distributionId: site.distributionId, suspended, functionArn: site.functionArn })
  await prisma.hostingSite.update({ where: { projectId }, data: { billingGateApplied: suspended } })
  await prisma.auditEvent.create({ data: { workspaceId: site.project.workspaceId, action: suspended ? 'billing.hosting.suspend' : 'billing.hosting.restore', targetType: 'Project', targetId: projectId } })
}
