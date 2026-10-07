import { prisma, type Prisma } from '@awb/database'
import type Stripe from 'stripe'
import { appUrl } from './account-security'
import { sendAccountEmail } from './account-email'
import { paymentEmail, welcomeEmail, subscriptionEmail, trialEmail, type SubscriptionNoticeKind } from './transactional-email-template'

export async function queueWelcomeEmail(tx: Prisma.TransactionClient, user: { id: string; email: string; name: string | null }) {
  const email = welcomeEmail(user.name, appUrl())
  return tx.transactionalEmail.upsert({ where: { dedupeKey: `welcome:${user.id}` }, create: { dedupeKey: `welcome:${user.id}`, kind: 'WELCOME', recipient: user.email, ...email }, update: {} })
}

export async function queuePaymentEmail(tx: Prisma.TransactionClient, workspace: { id: string; name: string; stripeCustomerId: string | null; billingStatus?: string; billingPaidThrough?: Date | null }, invoice: Stripe.Invoice) {
  const customer = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id
  if (invoice.status !== 'paid' || customer !== workspace.stripeCustomerId) return
  const owners = await tx.workspaceMember.findMany({ where: { workspaceId: workspace.id, role: 'OWNER', user: { suspendedAt: null, OR: [{ emailVerified: { not: null } }, { accounts: { some: { provider: 'google' } } }] } }, include: { user: true } })
  const email = paymentEmail(invoice, workspace.name, appUrl(), workspace.billingStatus === 'active' && !!workspace.billingPaidThrough && workspace.billingPaidThrough > new Date())
  for (const { user } of owners) {
    const dedupeKey = `receipt:${invoice.id}:${user.id}`
    await tx.transactionalEmail.upsert({ where: { dedupeKey }, create: { dedupeKey, kind: 'PAYMENT_RECEIPT', recipient: user.email, ...email }, update: {} })
  }
}

export async function queueSubscriptionEmail(tx: Prisma.TransactionClient, workspace: { id: string; name: string; billingStatus: string; billingPeriodEnd: Date | null; billingPaidThrough: Date | null }, kind: SubscriptionNoticeKind, transitionId: string) {
  const owners = await tx.workspaceMember.findMany({ where: { workspaceId: workspace.id, role: 'OWNER', user: { suspendedAt: null, OR: [{ emailVerified: { not: null } }, { accounts: { some: { provider: 'google' } } }] } }, include: { user: true } })
  const email = subscriptionEmail(kind, workspace.name, workspace.billingPeriodEnd, appUrl(), !['active', 'trialing'].includes(workspace.billingStatus), workspace.billingStatus === 'trialing')
  for (const { user } of owners) {
    const dedupeKey = `subscription:${transitionId}:${kind}:${user.id}`
    await tx.transactionalEmail.upsert({ where: { dedupeKey }, create: { dedupeKey, kind, recipient: user.email, ...email }, update: {} })
  }
}

export async function queueTrialEmail(tx: Prisma.TransactionClient, workspace: { id: string; name: string; billingTrialEnd: Date | null }, subscriptionId: string) {
  if (!workspace.billingTrialEnd) return
  const owners = await tx.workspaceMember.findMany({ where: { workspaceId: workspace.id, role: 'OWNER', user: { suspendedAt: null, OR: [{ emailVerified: { not: null } }, { accounts: { some: { provider: 'google' } } }] } }, include: { user: true } })
  const kind = 'TRIAL_STARTED'
  const email = trialEmail(workspace.name, workspace.billingTrialEnd, appUrl())
  for (const { user } of owners) {
    await queueWelcomeEmail(tx, user)
    const dedupeKey = `trial:${subscriptionId}:${kind}:${user.id}`
    await tx.transactionalEmail.upsert({ where: { dedupeKey }, create: { dedupeKey, kind, recipient: user.email, ...email }, update: {} })
  }
}

// An atomic claim prevents competing workers and webhook retries from sending twice.
// Uncertain outcomes require review because SES may already have accepted the email.
export async function deliverTransactionalEmails({ id, send = sendAccountEmail }: { id?: string; send?: typeof sendAccountEmail } = {}) {
  await prisma.transactionalEmail.updateMany({ where: { ...(id ? { id } : {}), status: 'SENDING', nextAttemptAt: { lt: new Date(Date.now() - 120000) } }, data: { status: 'UNKNOWN', lastError: 'Delivery interrupted; check SES before resending.' } })
  let handled = 0
  for (let i = 0; i < 5; i++) {
    const email = await prisma.transactionalEmail.findFirst({ where: { ...(id ? { id } : {}), status: 'PENDING', nextAttemptAt: { lte: new Date() } }, orderBy: { createdAt: 'asc' } })
    if (!email) break
    if (email.kind === 'TRIAL_STARTED') {
      const workspace = await prisma.workspace.findUnique({ where: { stripeSubscriptionId: email.dedupeKey.split(':')[1] }, select: { billingStatus: true, billingTrialEnd: true, cancelAtPeriodEnd: true, status: true } })
      if (!workspace || workspace.status !== 'ACTIVE' || workspace.billingStatus !== 'trialing' || !workspace.billingTrialEnd || workspace.billingTrialEnd <= new Date() || workspace.cancelAtPeriodEnd) {
        await prisma.transactionalEmail.updateMany({ where: { id: email.id, status: 'PENDING' }, data: { status: 'SKIPPED' } })
        continue
      }
    }
    const claim = await prisma.transactionalEmail.updateMany({ where: { id: email.id, status: 'PENDING' }, data: { status: 'SENDING', attempts: { increment: 1 }, nextAttemptAt: new Date() } })
    if (!claim.count) continue
    try {
      await send(email.recipient, email.subject, email.body, email.html ?? undefined)
      await prisma.transactionalEmail.update({ where: { id: email.id }, data: { status: 'SENT', sentAt: new Date(), lastError: null } })
    } catch (error) {
      const cause = error instanceof Error && error.cause instanceof Error ? error.cause : error
      const name = cause instanceof Error ? cause.name : ''
      const retry = ['TooManyRequestsException', 'ThrottlingException', 'LimitExceededException'].includes(name)
      const rejected = ['MessageRejected', 'MessageRejectedException', 'BadRequestException', 'MailFromDomainNotVerifiedException', 'AccountSuspendedException', 'SendingPausedException', 'AccessDeniedException', 'NotFoundException'].includes(name)
      await prisma.transactionalEmail.update({ where: { id: email.id }, data: {
        status: retry && email.attempts < 4 ? 'PENDING' : retry || rejected ? 'FAILED' : 'UNKNOWN',
        nextAttemptAt: new Date(Date.now() + 60000 * 2 ** email.attempts),
        lastError: retry ? 'Email rate limit reached; retry scheduled (up to five attempts).' : rejected ? 'Email provider rejected delivery; check sender configuration and permissions.' : 'Delivery outcome uncertain; check SES before resending.',
      } })
    }
    handled++
  }
  return handled
}
