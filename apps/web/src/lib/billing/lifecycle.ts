import { prisma } from '@awb/database'
import { billingLifecycle, BILLING_DAY } from '@awb/database/billing-policy'
import { syncSubscription } from './service'
import { queueBillingNotices } from './notifications'
import { deliverTransactionalEmails } from '../transactional-email'
import { sendAccountEmail } from '../account-email'
import { withHostingLock, syncBillingHosting } from '../hosting/service'

export async function reconcileBillingLifecycle(workspaceId: string, now = new Date()) {
  return prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT "id" FROM "Workspace" WHERE "id" = ${workspaceId} FOR UPDATE`
    const current = await tx.workspace.findUniqueOrThrow({ where: { id: workspaceId } })
    const state = billingLifecycle(current, now)
    const reset = state.phase === 'ACTIVE' || state.phase === 'TRIAL'
    const suspendedAt = state.suspendAt
    const data = reset ? { billingSuspendedAt: null, billingRetentionEndsAt: null, billingDeletionEligibleAt: null } : suspendedAt ? { billingSuspendedAt: suspendedAt, billingRetentionEndsAt: state.retentionEndsAt } : {}
    const workspace = await tx.workspace.update({ where: { id: workspaceId }, data })
    if (reset) await tx.billingNotice.updateMany({ where: { workspaceId, status: 'PENDING' }, data: { status: 'SKIPPED' } })
    else await queueBillingNotices(tx, workspace, now)
    if (state.deletionEligible && workspace.billingSuspendedAt) {
      const warnings = await tx.billingNotice.findMany({ where: { workspaceId, cycleKey: workspace.billingSuspendedAt.toISOString(), kind: { startsWith: 'RETENTION_' }, status: 'SENT' }, select: { kind: true, sentAt: true, recipient: true } })
      const recipients = new Set(warnings.map(w => w.recipient))
      const sufficientlyWarned = [...recipients].some(recipient => {
        const sent = warnings.filter(w => w.recipient === recipient && w.sentAt)
        const times = sent.map(w => w.sentAt!.getTime())
        return new Set(sent.map(w => w.kind)).size >= 2 && Math.max(...times) - Math.min(...times) >= BILLING_DAY
      })
      if (sufficientlyWarned && !workspace.billingDeletionEligibleAt) {
        await tx.workspace.update({ where: { id: workspaceId }, data: { billingDeletionEligibleAt: now } })
        await tx.auditEvent.create({ data: { workspaceId, action: 'billing.retention.review-required', targetType: 'Workspace', targetId: workspaceId, metadata: { automaticDeletion: false, warningsDelivered: true } } })
      }
    }
    if (workspace.billingLegalHold && workspace.billingDeletionEligibleAt) await tx.workspace.update({ where: { id: workspaceId }, data: { billingDeletionEligibleAt: null } })
    return state
  })
}

export async function deliverBillingNotices() {
  await prisma.billingNotice.updateMany({ where: { status: 'SENDING', nextAttemptAt: { lt: new Date(Date.now() - 120000) } }, data: { status: 'UNKNOWN', lastError: 'Delivery outcome uncertain; review before resending.' } })
  let handled = 0
  for (let i = 0; i < 5; i++) {
    const notice = await prisma.billingNotice.findFirst({ where: { status: 'PENDING', nextAttemptAt: { lte: new Date() } }, orderBy: { createdAt: 'asc' }, include: { workspace: true } })
    if (!notice) break
    const state = billingLifecycle(notice.workspace)
    const currentCycle = notice.kind.startsWith('RETENTION_') || notice.kind === 'SUSPENDED' ? state.suspendAt?.toISOString() : notice.workspace.billingDelinquentSince?.toISOString()
    if (notice.workspace.billingExempt || state.phase === 'ACTIVE' || state.phase === 'TRIAL' || currentCycle !== notice.cycleKey || notice.kind === 'PAYMENT_FAILED' && !['GRACE', 'PAYMENT_REQUIRED'].includes(state.phase) || notice.kind === 'PAST_DUE' && state.phase !== 'PAST_DUE' || (notice.kind === 'SUSPENDED' || notice.kind.startsWith('RETENTION_')) && state.phase !== 'SUSPENDED') {
      await prisma.billingNotice.updateMany({ where: { id: notice.id, status: 'PENDING' }, data: { status: 'SKIPPED' } }); continue
    }
    const recent = await prisma.billingNotice.findFirst({ where: { workspaceId: notice.workspaceId, recipient: notice.recipient, status: 'SENT', sentAt: { gt: new Date(Date.now() - BILLING_DAY) } }, orderBy: { sentAt: 'desc' } })
    if (recent?.sentAt) { await prisma.billingNotice.update({ where: { id: notice.id }, data: { nextAttemptAt: new Date(recent.sentAt.getTime() + BILLING_DAY) } }); continue }
    const claimed = await prisma.billingNotice.updateMany({ where: { id: notice.id, status: 'PENDING' }, data: { status: 'SENDING', attempts: { increment: 1 }, nextAttemptAt: new Date() } })
    if (!claimed.count) continue
    try {
      await sendAccountEmail(notice.recipient, notice.subject, notice.body)
      await prisma.billingNotice.update({ where: { id: notice.id }, data: { status: 'SENT', sentAt: new Date(), lastError: null } })
    } catch {
      // A timeout may occur after SES accepted a message. Never duplicate an uncertain send.
      await prisma.billingNotice.update({ where: { id: notice.id }, data: { status: 'UNKNOWN', lastError: 'Delivery failed or uncertain; review SES before resending.' } })
    }
    handled++
  }
  return handled
}

export async function runBillingSweep() {
  const emails = await deliverTransactionalEmails()
  const workspaces = await prisma.workspace.findMany({ where: { OR: [{ stripeSubscriptionId: { not: null } }, { billingSuspendedAt: { not: null } }, { billingDelinquentSince: { not: null } }, { projects: { some: { hosting: { distributionId: { not: null } } } } }] }, orderBy: { billingLastReconciledAt: { sort: 'asc', nulls: 'first' } }, take: 20 })
  let processed = 0; let failed = 0
  for (const workspace of workspaces) {
    try {
      if (workspace.stripeSubscriptionId && (!workspace.billingLastReconciledAt || Date.now() - workspace.billingLastReconciledAt.getTime() > 30 * 60000 || workspace.billingStatus === 'trialing' && !!workspace.billingTrialEnd && workspace.billingTrialEnd <= new Date() || workspace.cancelAtPeriodEnd && !!workspace.billingPaidThrough && workspace.billingPaidThrough <= new Date())) await syncSubscription(workspace.id, workspace.stripeSubscriptionId)
      await reconcileBillingLifecycle(workspace.id)
      const sites = await prisma.hostingSite.findMany({ where: { project: { workspaceId: workspace.id }, OR: [{ distributionId: { not: null } }, { serverId: { not: null } }] }, select: { projectId: true } })
      for (const site of sites) await withHostingLock(site.projectId, () => syncBillingHosting(site.projectId))
      processed++
    } catch { failed++ }
  }
  return { processed, failed, emails, notifications: await deliverBillingNotices() }
}
