import type { Prisma, Workspace } from '@awb/database'
import { billingLifecycle, BILLING_DAY } from '@awb/database/billing-policy'
import { appUrl } from '../account-security'

export async function queueBillingNotices(tx: Prisma.TransactionClient, workspace: Workspace, now = new Date()) {
  if (workspace.billingExempt || workspace.status !== 'ACTIVE') return
  const state = billingLifecycle(workspace, now)
  const since = workspace.billingDelinquentSince
  const suspendAt = state.suspendAt
  const notices: { kind: string; subject: string; text: string; cycle: Date }[] = []
  if (since && !['ACTIVE', 'SUSPENDED'].includes(state.phase)) {
    notices.push(state.phase === 'PAST_DUE' ? { kind: 'PAST_DUE', subject: 'Action required: restore your Webtummy payment', text: 'Your website remains live until 30 days after the first failed payment, but website editing and AI generation are restricted. Update your payment method or pay the outstanding invoice through Plans & billing.', cycle: since } : { kind: 'PAYMENT_FAILED', subject: 'Your Webtummy payment needs attention', text: state.phase === 'PAYMENT_REQUIRED' ? 'Your subscription payment did not complete. Payment is required before building your website. Update your payment method through Plans & billing.' : 'Your renewal payment did not complete. Your website and editor remain available during the 7-day grace period. Stripe will retry eligible payments according to its retry schedule. Update your payment method through Plans & billing.', cycle: since })
  }
  if (suspendAt && state.retentionEndsAt) {
    const age = (now.getTime() - suspendAt.getTime()) / BILLING_DAY
    const deadline = state.retentionEndsAt.toLocaleDateString('en-US', { timeZone: 'UTC' })
    const base = `Your website is temporarily unavailable. Your saved website and data are retained until at least ${deadline}. Subscribe or resolve your outstanding payment to reactivate it. No website data has been deleted.`
    if (age < 60) notices.push({ kind: 'SUSPENDED', subject: 'Your Webtummy website is temporarily suspended', text: base, cycle: suspendAt })
    else {
      const days = age >= 89 ? 1 : age >= 83 ? 7 : 30
      notices.push({ kind: `RETENTION_${days}`, subject: 'Important: your retained Webtummy website needs attention', text: `${base} After the retention period, the website and data may be permanently deleted after multiple warnings and review, subject to legal requirements and our terms. Please reactivate before ${deadline} or contact support@webtummy.com.`, cycle: suspendAt })
    }
  }
  if (!notices.length) return
  const owners = await tx.workspaceMember.findMany({ where: { workspaceId: workspace.id, role: 'OWNER', user: { suspendedAt: null } }, include: { user: { select: { id: true, email: true } } } })
  for (const notice of notices) for (const owner of owners) {
    const cycleKey = notice.cycle.toISOString()
    await tx.billingNotice.upsert({ where: { dedupeKey: `${workspace.id}:${cycleKey}:${notice.kind}:${owner.user.id}` }, create: { workspaceId: workspace.id, dedupeKey: `${workspace.id}:${cycleKey}:${notice.kind}:${owner.user.id}`, cycleKey, kind: notice.kind, recipient: owner.user.email, subject: notice.subject, body: `${notice.text}\n\nManage payment and subscription: ${appUrl()}/billing\nSupport: support@webtummy.com` }, update: {} })
  }
}
