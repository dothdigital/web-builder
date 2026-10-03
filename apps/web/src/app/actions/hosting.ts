'use server'
import { redirect } from 'next/navigation'
import { paidAccess } from '@/lib/billing/access'
import { randomBytes } from 'node:crypto'
import { prisma, WorkspaceRole } from '@awb/database'
import { requireProject } from '@/lib/tenancy'
import { revalidatePath } from 'next/cache'
import { assertCustomerHostname, normalizeHostname, hostingConfig } from '@/lib/hosting/config'
import { distributionDetails } from '@/lib/hosting/aws'
import { withHostingLock, prepareSite, syncHosting, publishSite } from '@/lib/hosting/service'

async function run(projectId: string, task: () => Promise<unknown>) {
  const { project } = await requireProject(projectId)
  if (!paidAccess(project.workspace)) redirect('/billing?reason=live-domain')
  await requireProject(projectId, WorkspaceRole.EDITOR)
  try { await withHostingLock(projectId, task); revalidatePath(`/projects/${projectId}/publishing`); revalidatePath('/dashboard'); return { ok: true, message: 'Updated. DNS and AWS deployment changes can take several minutes.' } }
  catch (error) {
    const message = error instanceof Error ? error.message : ''
    // Avoid returning SDK request details, credentials or infrastructure internals.
    const safe = /^(Enter |This domain|That domain|AWS hosting is not configured|A publishing|The previous|Complete ownership|Save a generated|Fix the|Publishing failed|AWS deployment needs|Only |Select |Remove |You can add)/.test(message)
    return { ok: false, message: safe ? message : 'Could not complete this action. Check hosting configuration and try again.' }
  }
}
export async function addHostingDomain(projectId: string, value: string) {
  return run(projectId, async () => {
    const hostname = normalizeHostname(value); assertCustomerHostname(hostname)
    if (await prisma.domain.count({ where: { projectId } }) >= 10) throw new Error('You can add up to 10 domains per website.')
    if (await prisma.domain.findUnique({ where: { hostname } })) throw new Error('That domain is already connected or awaiting verification. Contact the platform administrator if you own it.')
    await prisma.domain.create({ data: { projectId, hostname, verificationToken: `webtummy-${randomBytes(24).toString('hex')}`, isPrimary: false } })
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
    // A live alias must not be freed in the DB while CloudFront still owns it.
    if (domain.verifiedAt || domain.status === 'ACTIVE') throw new Error('Only unverified domains can be removed here. Contact the platform administrator to disconnect a verified domain safely.')
    const site = await prisma.hostingSite.findUnique({ where: { projectId } })
    if (site?.distributionId) {
      if (!hostingConfig().configured || (await distributionDetails(site.distributionId))?.DistributionConfig?.Aliases?.Items?.includes(domain.hostname)) throw new Error('Only domains that are not attached to a live distribution can be removed here.')
    }
    await prisma.domain.delete({ where: { id: domainId } })
  })
}
export async function prepareHosting(projectId: string) { return run(projectId, () => prepareSite(projectId)) }
export async function checkHosting(projectId: string) { return run(projectId, async () => { if (!hostingConfig().configured) throw new Error('AWS hosting is not configured yet. DNS records can be prepared now; verification activates after AWS setup.'); await syncHosting(projectId) }) }
export async function publishHosting(projectId: string) {
  const { user } = await requireProject(projectId)
  return run(projectId, () => publishSite(projectId, user.id))
}
