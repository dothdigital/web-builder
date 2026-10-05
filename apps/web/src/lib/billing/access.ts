import { prisma, type Prisma } from '@awb/database'
import { billingLifecycle, type BillingAccess } from '@awb/database/billing-policy'
export { billingLifecycle } from '@awb/database/billing-policy'
export function paidAccess(workspace: BillingAccess) { return billingLifecycle(workspace).editing }
export function editingAccess(workspace: BillingAccess) { return billingLifecycle(workspace).editing }
export function hostingAccess(workspace: BillingAccess) { return billingLifecycle(workspace).hosting }
export class BillingAccessError extends Error { readonly status = 402 }
export async function requirePaidWorkspace(workspaceId: string) {
  const workspace = await prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId } })
  if (!editingAccess(workspace)) throw new BillingAccessError('Payment is required to create, edit or generate content. Open Plans & billing to subscribe or resolve your payment. Your saved work is preserved.')
  return workspace
}
export async function assertWebsiteCapacity(tx: Prisma.TransactionClient, workspaceId: string) {
  await tx.$queryRaw`SELECT "id" FROM "Workspace" WHERE "id" = ${workspaceId} FOR UPDATE`
  const workspace = await tx.workspace.findUniqueOrThrow({ where: { id: workspaceId }, include: { billingPlan: true, _count: { select: { projects: true } } } })
  if (!editingAccess(workspace)) throw new BillingAccessError('Payment is required before creating a website. Choose Individual in Plans & billing.')
  if (!workspace.billingExempt && workspace._count.projects >= (workspace.billingPlan?.websiteLimit ?? 0)) throw new Error('Your Individual plan includes one website. Contact support if you need help with your existing website.')
}
export function money(amount: number, currency: string) { return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency.toUpperCase(), maximumFractionDigits: 2 }).format(amount / 100) }
