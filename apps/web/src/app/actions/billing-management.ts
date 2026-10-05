'use server'

import { prisma, WorkspaceRole } from '@awb/database'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { primaryWorkspace, requireUser, requireWorkspace } from '@/lib/tenancy'
import { appUrl } from '@/lib/account-security'
import { billingManagementSummary, createPaymentSetup, applyPaymentSetup, scheduleSubscriptionCancellation } from '@/lib/billing/management'
import { syncSubscription } from '@/lib/billing/service'

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
    // Stripe is authoritative even when the webhook has not reached this server.
    try { await syncSubscription(workspace.id, subscription.id) }
    catch {
      await prisma.workspace.update({ where: { id: workspace.id, stripeSubscriptionId: subscription.id }, data: { cancelAtPeriodEnd: true } })
    }
    revalidatePath('/billing')
    revalidatePath('/dashboard')
    return { ok: true as const, message: 'Renewal cancelled. Your access continues through your paid period.' }
  } catch { return { ok: false as const, message: 'Cancellation could not complete. Please refresh billing and try again.' } }
}
