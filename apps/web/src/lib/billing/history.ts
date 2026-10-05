import { prisma, WorkspaceRole } from '@awb/database'
import { AuthorizationError, requireUser } from '@/lib/tenancy'
import { stripeClient } from './stripe'

export async function requireBillingAccess(workspaceId: string) {
  const user = await requireUser()
  const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId }, include: { members: { where: { userId: user.id }, select: { role: true } } } })
  if (!workspace || (!user.isPlatformAdmin && workspace.members[0]?.role !== WorkspaceRole.OWNER)) throw new AuthorizationError('Billing access denied')
  return { user, workspace }
}

export function invoiceCursor(value?: string) {
  if (!value) return undefined
  if (!/^in_[a-zA-Z0-9]{1,100}$/.test(value)) throw new Error('Invalid invoice cursor')
  return value
}

export async function paymentHistory(workspaceId: string, after?: string) {
  const { workspace } = await requireBillingAccess(workspaceId)
  const cursor = invoiceCursor(after)
  if (!workspace.stripeCustomerId) return { data: [], has_more: false }
  const stripe = stripeClient()
  if (cursor) {
    const invoice = await stripe.invoices.retrieve(cursor)
    const customer = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id
    if (customer !== workspace.stripeCustomerId) throw new AuthorizationError('Invoice access denied')
  }
  return stripe.invoices.list({ customer: workspace.stripeCustomerId, limit: 20, ...(cursor ? { starting_after: cursor } : {}) })
}
