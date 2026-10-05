import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@awb/database'
import { requireAdmin } from '@/lib/tenancy'
import { AppShell } from '@/components/account/app-shell'
import { ActionForm } from '@/components/account/action-form'
import { PaymentHistory } from '@/components/account/payment-history'
import { cancelCustomerSubscription } from '@/app/actions/admin'

export const dynamic = 'force-dynamic'
export default async function AdminBillingPage({ params, searchParams }: { params: Promise<{ workspaceId: string }>; searchParams: Promise<{ after?: string }> }) {
  await requireAdmin()
  const { workspaceId } = await params
  const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId }, include: { members: { where: { role: 'OWNER' }, include: { user: { select: { email: true, name: true } } } } } })
  if (!workspace) notFound()
  const { after } = await searchParams
  const cancellable = workspace.stripeSubscriptionId && !['canceled', 'incomplete_expired', 'none'].includes(workspace.billingStatus)
  return <AppShell title="Customer billing" active="/admin/users"><div className="wt-heading"><p className="wt-eyebrow">PLATFORM ADMIN</p><h1>Customer billing</h1><p>{workspace.name} · {workspace.members.map(member => member.user.email).join(', ')}</p><Link href="/admin/users">← Back to users</Link></div>
    <section className="wt-card"><h2>Subscription</h2><p>Status: {workspace.billingStatus.replaceAll('_', ' ')}</p>{workspace.billingPeriodEnd && <p>Current period ends: {workspace.billingPeriodEnd.toLocaleDateString('en-US')}</p>}
      {workspace.cancelAtPeriodEnd ? <p>Renewal is cancelled. The subscription ends after the current paid period.</p> : cancellable ? <><p>Cancel renewal on behalf of the customer. Paid access continues until the end of the current period, then the existing suspension and retention policy applies.</p><ActionForm action={cancelCustomerSubscription} label="Cancel subscription renewal"><input type="hidden" name="workspaceId" value={workspace.id} /><label>Reason<input name="reason" minLength={3} maxLength={300} required placeholder="Customer requested cancellation" /></label><label className="wt-check"><input type="checkbox" name="confirmed" required />I confirm cancellation of this customer’s subscription renewal.</label></ActionForm></> : <p className="wt-muted">No active subscription to cancel.</p>}
    </section><PaymentHistory workspaceId={workspace.id} after={after} basePath={`/admin/billing/${encodeURIComponent(workspace.id)}`} />
  </AppShell>
}
