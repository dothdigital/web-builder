'use server'

import { prisma, WorkspaceRole } from '@awb/database'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { primaryWorkspace, requireUser, requireWorkspace } from '@/lib/tenancy'
import { previewWebsiteSlot, purchaseWebsiteSlot, cancelPendingWebsiteSlot, WebsitePurchaseError } from '@/lib/billing/website-slots'
import { syncSubscription } from '@/lib/billing/service'
import { billingLifecycle } from '@/lib/billing/access'

async function ownerWorkspace() {
  const user = await requireUser(), workspace = await primaryWorkspace(user.id)
  if (!workspace) throw new Error('Workspace missing')
  await requireWorkspace(workspace.id, WorkspaceRole.OWNER)
  return workspace
}
const message = (error: unknown) => error instanceof WebsitePurchaseError ? error.message : 'We could not confirm this purchase. Refresh the status before trying again.'
function refreshPages() { revalidatePath('/billing'); revalidatePath('/dashboard'); revalidatePath('/onboarding') }

export async function reviewWebsitePurchase() {
  try {
    const workspace = await ownerWorkspace()
    if (workspace.stripeSubscriptionId) await syncSubscription(workspace.id, workspace.stripeSubscriptionId)
    const current = await prisma.workspace.findUniqueOrThrow({ where: { id: workspace.id } })
    return { ok: true as const, purchase: await previewWebsiteSlot(current) }
  } catch (error) { return { ok: false as const, message: message(error) } }
}

export async function confirmWebsitePurchase(token: string, confirmed: boolean) {
  try {
    z.literal(true).parse(confirmed)
    const parsed = z.string().min(1).max(3000).parse(token), workspace = await ownerWorkspace()
    const result = await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT "id" FROM "Workspace" WHERE "id" = ${workspace.id} FOR UPDATE`
      const current = await tx.workspace.findUniqueOrThrow({ where: { id: workspace.id } })
      return purchaseWebsiteSlot(current, parsed)
    }, { timeout: 60000, maxWait: 10000 })
    await syncSubscription(workspace.id, workspace.stripeSubscriptionId!)
    const current = await prisma.workspace.findUniqueOrThrow({ where: { id: workspace.id } })
    refreshPages()
    if (result.status === 'paid' && (current.billingWebsiteQuantity < result.quantity || billingLifecycle(current).phase !== 'ACTIVE')) return { ok: false as const, message: 'Your payment is being confirmed. Refresh the status; do not purchase again.' }
    return { ok: true as const, purchase: result }
  } catch (error) { return { ok: false as const, message: message(error) } }
}

export async function refreshWebsitePurchase() {
  try {
    const workspace = await ownerWorkspace()
    if (!workspace.stripeSubscriptionId) throw new Error('Subscription missing')
    await syncSubscription(workspace.id, workspace.stripeSubscriptionId)
    const current = await prisma.workspace.findUniqueOrThrow({ where: { id: workspace.id } })
    refreshPages()
    return { ok: true as const, quantity: current.billingWebsiteQuantity, paid: billingLifecycle(current).phase === 'ACTIVE' }
  } catch (error) { return { ok: false as const, message: message(error) } }
}

export async function cancelWebsitePurchase() {
  try {
    const workspace = await ownerWorkspace()
    await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT "id" FROM "Workspace" WHERE "id" = ${workspace.id} FOR UPDATE`
      await cancelPendingWebsiteSlot(await tx.workspace.findUniqueOrThrow({ where: { id: workspace.id } }))
    }, { timeout: 45000, maxWait: 10000 })
    await syncSubscription(workspace.id, workspace.stripeSubscriptionId!)
    refreshPages()
    return { ok: true as const }
  } catch (error) { return { ok: false as const, message: message(error) } }
}
