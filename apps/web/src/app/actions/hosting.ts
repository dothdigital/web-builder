'use server'
import { redirect } from 'next/navigation'
import { paidAccess } from '@/lib/billing/access'
import { randomBytes } from 'node:crypto'
import { prisma, WorkspaceRole } from '@awb/database'
import { requireProject } from '@/lib/tenancy'
import { revalidatePath } from 'next/cache'
import { assertCustomerHostname, normalizeHostname, hostingConfig } from '@/lib/hosting/config'
import { withHostingLock, prepareSite, syncHosting, publishSite } from '@/lib/hosting/service'
import { deployPreview, syncPreview } from '@/lib/hosting/preview'

async function run(projectId: string, task: () => Promise<unknown>) {
  const { user, project } = await requireProject(projectId)
  if (user.isPlatformSupport && !user.isPlatformAdmin) return { ok: false, message: 'Support access allows website editing. Publishing and domain changes require the customer or an administrator.' }
  if (!paidAccess(project.workspace)) redirect('/billing?reason=live-domain')
  await requireProject(projectId, WorkspaceRole.EDITOR)
  try { await withHostingLock(projectId, task); revalidatePath(`/projects/${projectId}/publishing`); revalidatePath('/dashboard'); return { ok: true, message: 'Updated. DNS and HTTPS changes can take several minutes.' } }
  catch (error) {
    const message = error instanceof Error ? error.message : ''
    // Avoid returning SDK request details, credentials or infrastructure internals.
    const safe = /^(Enter |This domain|That domain|Hosting is not configured|Hosting domain activation is unavailable|A publishing|The previous|Complete ownership|Save a generated|Fix the|Publishing failed|No healthy hosting server|Hosting capacity|Hosting server assignment|Publishing needs|Test deployment|Create a test|Only |Select |Remove |You can add)/.test(message)
    return { ok: false, message: safe ? message : 'Could not complete this action. Check hosting configuration and try again.' }
  }
}
export async function addHostingDomain(projectId: string, value: string) {
  return run(projectId, async () => {
    const site = await prisma.hostingSite.findUnique({ where: { projectId } })
    if (site?.pendingReleaseId) throw new Error('The previous release is still deploying. Wait before changing domains.')
    const hostname = normalizeHostname(value); assertCustomerHostname(hostname)
    const count = await prisma.domain.count({ where: { projectId } })
    if (count >= 10) throw new Error('You can add up to 10 domains per website.')
    if (await prisma.domain.findUnique({ where: { hostname } })) throw new Error('That domain is already connected or awaiting verification. Contact the platform administrator if you own it.')
    await prisma.domain.create({ data: { projectId, hostname, verificationToken: `webtummy-${randomBytes(24).toString('hex')}`, isPrimary: count === 0 } })
  })
}
export async function choosePrimaryDomain(projectId: string, domainId: string | null) {
  return run(projectId, async () => {
    const site = await prisma.hostingSite.findUnique({ where: { projectId } })
    if (site?.pendingReleaseId) throw new Error('The previous release is still deploying. Wait before changing domains.')
    if (domainId && !await prisma.domain.findFirst({ where: { id: domainId, projectId } })) throw new Error('Select a domain belonging to this website.')
    await prisma.$transaction(async (tx) => { await tx.domain.updateMany({ where: { projectId }, data: { isPrimary: false } }); if (domainId) await tx.domain.update({ where: { id: domainId }, data: { isPrimary: true } }) })
  })
}
export async function removePendingDomain(projectId: string, domainId: string) {
  return run(projectId, async () => {
    const domain = await prisma.domain.findFirst({ where: { id: domainId, projectId } })
    if (!domain) throw new Error('Select a domain belonging to this website.')
    if (domain.verifiedAt || domain.cloudflareHostnameId || domain.status === 'ACTIVE') throw new Error('Only unverified domains can be removed here. Contact the platform administrator to disconnect a verified domain safely.')
    const site = await prisma.hostingSite.findUnique({ where: { projectId } })
    if (site?.pendingReleaseId) throw new Error('The previous release is still deploying. Wait before changing domains.')
    await prisma.$transaction(async (tx) => {
      await tx.domain.delete({ where: { id: domainId } })
      if (domain.isPrimary) {
        const next = await tx.domain.findFirst({ where: { projectId }, orderBy: { createdAt: 'asc' } })
        if (next) await tx.domain.update({ where: { id: next.id }, data: { isPrimary: true } })
      }
    })
  })
}
export async function prepareHosting(projectId: string) { return run(projectId, () => prepareSite(projectId)) }
export async function checkHosting(projectId: string, deploymentOnly = false) {
  const result = await run(projectId, async () => {
    if (!hostingConfig().configured) throw new Error('Hosting is not configured yet. Domains can be added now; verification activates after Cloudflare and server setup.')
    await syncPreview(projectId)
    await syncHosting(projectId)
  })
  if (!result.ok) return result
  if (deploymentOnly) {
    const site = await prisma.hostingSite.findUniqueOrThrow({ where: { projectId }, select: { status: true, pendingReleaseId: true, deployedReleaseId: true, lastError: true } })
    return { ...result, message: site.pendingReleaseId ? 'Your website is deploying. This page checks progress automatically.' : site.status === 'LIVE' && site.deployedReleaseId ? 'Your website is live. Deployment completed successfully.' : site.lastError ?? 'No deployment is in progress. Publish your saved website to start.' }
  }
  const domains = await prisma.domain.findMany({ where: { projectId }, orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }], select: { hostname: true, verifiedAt: true, dnsReady: true, sslStatus: true } })
  const message = domains.length ? domains.map(domain => {
    const ready = !!domain.verifiedAt && domain.dnsReady && domain.sslStatus === 'active'
    return `${domain.hostname}: Ownership ${domain.verifiedAt ? 'verified' : 'pending'} · DNS routing ${domain.dnsReady ? 'verified' : 'pending'} · Cloudflare HTTPS ${domain.sslStatus === 'active' ? 'active' : 'pending'}. ${ready ? 'Domain verified and ready to publish.' : 'Verification is still pending. Review the DNS records below and check again after they update.'}`
  }).join('\n') : 'Status checked. Your Webtummy address does not require custom DNS records.'
  return { ...result, message }
}
export async function createTestUrl(projectId: string) {
  const { user } = await requireProject(projectId)
  let preview: { url: string; ready: boolean } | undefined
  const result = await run(projectId, async () => { preview = await deployPreview(projectId, user.id) })
  return { ...result, message: result.ok ? preview?.ready ? 'Your test link is ready to share.' : 'Preparing your test link…' : result.message, url: result.ok && preview?.ready ? preview.url : null, deploying: result.ok && !preview?.ready }
}
export async function checkTestUrl(projectId: string) {
  const result = await run(projectId, () => syncPreview(projectId))
  if (!result.ok) return { ...result, url: null, deploying: false }
  const site = await prisma.hostingSite.findUniqueOrThrow({ where: { projectId } })
  const ready = site.previewStatus === 'READY' && !!site.previewDeployedReleaseId && !!site.previewHost
  return { ok: true, message: ready ? 'Your test link is ready to share.' : site.previewLastError ?? 'Preparing your test link…', url: ready ? `https://${site.previewHost}` : null, deploying: !!site.previewPendingReleaseId }
}
export async function publishHosting(projectId: string) {
  const { user } = await requireProject(projectId)
  const result = await run(projectId, () => publishSite(projectId, user.id))
  if (!result.ok) return result
  const site = await prisma.hostingSite.findUniqueOrThrow({ where: { projectId }, select: { status: true, pendingReleaseId: true, deployedReleaseId: true, publicHost: true } })
  const primary = await prisma.domain.findFirst({ where: { projectId, isPrimary: true }, select: { hostname: true } })
  const live = site.status === 'LIVE' && !!site.deployedReleaseId && !site.pendingReleaseId
  const url = `https://${primary?.hostname ?? site.publicHost}`
  return { ...result, message: live ? `Your website is live at ${url}. Publishing completed successfully.` : 'Publishing started. Your website is deploying; this page checks progress automatically.' }

}
