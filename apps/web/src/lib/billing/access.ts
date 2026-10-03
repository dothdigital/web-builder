import { prisma, type Prisma } from '@awb/database'
type Access = { billingExempt: boolean; status: string; billingStatus: string; billingPeriodEnd: Date | null; billingPlanId: string | null; trialEndsAt?: Date }
export function paidAccess(workspace: Access) {
  return workspace.status === 'ACTIVE' && (workspace.billingExempt || !!workspace.billingPlanId && workspace.billingStatus === 'active' && !!workspace.billingPeriodEnd && workspace.billingPeriodEnd.getTime() > Date.now())
}
export function trialAccess(workspace: Access) {
  return workspace.status === 'ACTIVE' && !!workspace.trialEndsAt && workspace.trialEndsAt.getTime() > Date.now()
}
export function editingAccess(workspace: Access) { return paidAccess(workspace) || trialAccess(workspace) }
export async function requirePaidWorkspace(workspaceId: string) {
  const workspace = await prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId } })
  if (!editingAccess(workspace)) throw new Error('Your trial has ended or your subscription needs attention. Open Plans & billing to continue. Your saved work is preserved.')
  return workspace
}
export async function assertWebsiteCapacity(tx: Prisma.TransactionClient, workspaceId: string) {
  await tx.$queryRaw`SELECT "id" FROM "Workspace" WHERE "id" = ${workspaceId} FOR UPDATE`
  const workspace = await tx.workspace.findUniqueOrThrow({ where: { id: workspaceId }, include: { billingPlan: true, _count: { select: { projects: true } } } })
  if (!editingAccess(workspace)) throw new Error('Your trial has ended. Choose an active plan in Plans & billing to continue.')
  const limit = paidAccess(workspace) ? workspace.billingPlan?.websiteLimit ?? 0 : workspace.trialWebsiteLimit
  if (!workspace.billingExempt && workspace._count.projects >= limit) throw new Error('Your website limit has been reached. Upgrade your plan to add another website.')
}
export function money(amount: number, currency: string) { return new Intl.NumberFormat('en-CA', { style: 'currency', currency: currency.toUpperCase(), maximumFractionDigits: 2 }).format(amount / 100) }

export function trialDaysLeft(workspace: Access) { return workspace.trialEndsAt ? Math.max(0, Math.ceil((workspace.trialEndsAt.getTime() - Date.now()) / 86400000)) : 0 }
