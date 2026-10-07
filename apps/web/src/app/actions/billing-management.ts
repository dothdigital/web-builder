'use server'

import { prisma, WorkspaceRole } from '@awb/database'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { after } from 'next/server'
import type Stripe from 'stripe'
import { primaryWorkspace, requireUser, requireWorkspace } from '@/lib/tenancy'
import { appUrl } from '@/lib/account-security'
import { billingManagementSummary, createPaymentSetup, applyPaymentSetup, scheduleSubscriptionCancellation, resumeSubscriptionRenewal } from '@/lib/billing/management'
import { syncSubscription } from '@/lib/billing/service'
import { deliverTransactionalEmails, queueSubscriptionEmail } from '@/lib/transactional-email'

async function ownerWorkspace() {
  const user = await requireUser()
  const base = await primaryWorkspace(user.id)
  if (!base) throw new Error('No workspace found.')
  await requireWorkspace(base.id, WorkspaceRole.OWNER)
  return prisma.workspace.findUniqueOrThrow({ where: { id: base.id } })
}

export async function loadBillingManagement() {
  try { return { ok: true as const, summary: await billingManagementSummary(await ownerWorkspace()) } }
  catch { return { ok: false as const, message: 'Billing details could not load. Please try again.' } }
}

export async function startPaymentUpdate() {
  try {
    const workspace = await ownerWorkspace()
    const publishableKey = process.env.STRIPE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
    if (!publishableKey) return { ok: false as const, message: 'Payment updates are temporarily unavailable. Please contact support.' }
    const setup = await createPaymentSetup(workspace)
    if (!setup.client_secret) throw new Error('Payment setup unavailable.')
    return { ok: true as const, clientSecret: setup.client_secret, publishableKey, returnUrl: `${appUrl()}/billing` }
  } catch { return { ok: false as const, message: 'Payment updates could not start. Please try again.' } }
}

export async function finishPaymentUpdate(setupId: string) {
  try {
    const workspace = await ownerWorkspace()
    await applyPaymentSetup(workspace, z.string().regex(/^seti_[a-zA-Z0-9]+$/).parse(setupId))
    revalidatePath('/billing')
    return { ok: true as const, message: 'Payment details updated for future subscription payments.' }
  } catch { return { ok: false as const, message: 'We could not save your payment details. Please try again.' } }
}

export async function cancelSubscription(confirmed: boolean) {
  try {
    const workspace = await ownerWorkspace()
    const subscription = await scheduleSubscriptionCancellation(workspace, z.literal(true).parse(confirmed))
    await reconcileRenewalChange(workspace.id, subscription)
    after(() => deliverTransactionalEmails().catch(() => console.error('Subscription email delivery delayed; queued for retry.')))
    revalidatePath('/billing')
    revalidatePath('/dashboard')
    return { ok: true as const, message: 'Renewal cancelled. Check Plans & billing for your access and subscription end date.' }
  } catch { return { ok: false as const, message: 'Cancellation could not complete. Please refresh billing and try again.' } }
}

async function reconcileRenewalChange(workspaceId: string, subscription: Stripe.Subscription) {
  // Persist the Stripe-confirmed renewal flag and its email together, even if invoice
  // reconciliation is temporarily unavailable. Full access is never granted here.
  try { await syncSubscription(workspaceId, subscription.id) }
  catch {
    await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT "id" FROM "Workspace" WHERE "id" = ${workspaceId} FOR UPDATE`
      const current = await tx.workspace.findUniqueOrThrow({ where: { id: workspaceId } })
      if (current.stripeSubscriptionId !== subscription.id) throw new Error('Subscription changed; refresh billing.')
      const changed = current.cancelAtPeriodEnd !== subscription.cancel_at_period_end
      const workspace = await tx.workspace.update({ where: { id: workspaceId }, data: { cancelAtPeriodEnd: subscription.cancel_at_period_end, billingLastReconciledAt: null } })
      if (changed) {
        const audit = await tx.auditEvent.create({ data: { workspaceId, action: 'billing.renewal.change', targetType: 'Subscription', targetId: subscription.id, metadata: { cancelAtPeriodEnd: subscription.cancel_at_period_end, reconciliationPending: true } } })
        await queueSubscriptionEmail(tx, workspace, subscription.cancel_at_period_end ? 'CANCELLATION' : 'RESUMED', audit.id)
      }
    })
  }
}

export async function resumeSubscription(confirmed: boolean) {
  try {
    const workspace = await ownerWorkspace()
    const subscription = await resumeSubscriptionRenewal(workspace, z.literal(true).parse(confirmed))
    await reconcileRenewalChange(workspace.id, subscription)
    after(() => deliverTransactionalEmails().catch(() => console.error('Subscription email delivery delayed; queued for retry.')))
    revalidatePath('/billing')
    revalidatePath('/dashboard')
    return { ok: true as const, message: 'Automatic billing is restored on your existing billing date. If you are on a trial, its original end date is unchanged. No payment was charged for resuming.' }
  } catch { return { ok: false as const, message: 'We could not resume renewal. Refresh billing; if your subscription has ended, use Reactivate subscription.' } }
}
