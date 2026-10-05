import { INDIVIDUAL_PLAN_SLUG, individualPriceFilter } from '@/lib/billing/catalog'
import Link from 'next/link'
import { prisma, WorkspaceRole } from '@awb/database'
import { requirePageUser, primaryWorkspace, requireWorkspace } from '@/lib/tenancy'
import { billingLifecycle } from '@/lib/billing/access'
import { stripeReady } from '@/lib/billing/stripe'
import { AppShell } from '@/components/account/app-shell'
import { PlanCards } from '@/components/account/plan-cards'
import { ActionForm } from '@/components/account/action-form'
import { PaymentHistory } from '@/components/account/payment-history'
import { openBillingPortal } from '@/app/actions/billing'
export default async function BillingPage({ searchParams }: { searchParams: Promise<{ checkout?: string; updated?: string; reason?: string; after?: string }> }) {
  const user = await requirePageUser(); const base = await primaryWorkspace(user.id); if (!base) return null
  const { membership } = await requireWorkspace(base.id)
  const workspace = await prisma.workspace.findUniqueOrThrow({ where: { id: base.id }, include: { billingPlan: true, _count: { select: { projects: true } } } })
  const plans = await prisma.billingPlan.findMany({ where: { active: true, slug: INDIVIDUAL_PLAN_SLUG }, include: { prices: { where: individualPriceFilter } } })
  const query = await searchParams
  const state = billingLifecycle(workspace)
  const staff = user.isPlatformAdmin || user.isPlatformSupport
  const labels = { ACTIVE: workspace.billingPlan?.name ?? 'Full access', GRACE: 'Payment grace period', PAST_DUE: 'Payment overdue — editing restricted', SUSPENDED: 'Website temporarily suspended', PAYMENT_REQUIRED: 'Payment required before building' }
  return <AppShell title="Plans & billing" active="/billing">
    <div className="wt-heading"><p className="wt-eyebrow">INDIVIDUAL PLAN</p><h1>Everything Included for $29/Month</h1><p>Individual · 1 website · US$29 per month · monthly billing only. No trial period.</p></div>
    {(query.checkout === 'success' || query.updated) && <div className="wt-notice">Your payment is being confirmed with Stripe. Website access opens after payment confirmation. <Link href="/dashboard">Continue to your dashboard →</Link> <Link href="/billing">Refresh status →</Link></div>}
    {query.checkout === 'cancelled' && <div className="wt-notice">Checkout was cancelled. Your subscription has not changed.</div>}
    <section className="wt-billing-summary wt-card"><div><p className="wt-eyebrow">CURRENT ACCESS</p><h2>{staff ? 'Admin and support — no payment required' : workspace.billingExempt ? 'Payment skipped — full access' : labels[state.phase]}</h2><p className="wt-muted">{workspace._count.projects} websites · {workspace.billingExempt ? 'Full access without payment' : '1 website included with Individual'}</p>
      {workspace.cancelAtPeriodEnd && workspace.billingPaidThrough && <p>Renewal cancelled. Access continues until {workspace.billingPaidThrough.toLocaleDateString('en-US')}.</p>}
      {state.phase === 'GRACE' && <p>Your website and editor remain fully available for 7 days after the failed renewal. Update your payment method to keep access.</p>}
      {state.phase === 'PAST_DUE' && <p>Your website remains live through day 30 after the failed renewal. Editing, AI and content generation are restricted until payment is resolved.</p>}
      {state.phase === 'SUSPENDED' && <p>Visitors see a neutral temporary page. Your website and data are preserved. Reactivate your subscription to restore access.</p>}
      {workspace.billingRetentionEndsAt && <p>Data retained until at least {workspace.billingRetentionEndsAt.toLocaleDateString('en-US')}. Multiple warnings are sent before any permanent deletion review.</p>}
      {workspace.billingNextRetryAt && <p>Stripe’s next scheduled payment attempt: {workspace.billingNextRetryAt.toLocaleDateString('en-US')}.</p>}
      {state.phase === 'PAYMENT_REQUIRED' && !staff && <p>Subscribe and enter your payment details before creating or editing a website. Existing saved work is preserved.</p>}
    </div>{!staff && !workspace.billingExempt && workspace.stripeCustomerId && membership.role === WorkspaceRole.OWNER && <ActionForm action={openBillingPortal} label="Manage payment, invoices & cancellation" />}</section>
    {!stripeReady() && !staff && <div className="wt-notice">Payments are temporarily unavailable. Contact support@webtummy.com.</div>}
    {!staff && !workspace.billingExempt && <><PlanCards plans={plans} signedIn currentPlanId={workspace.billingPlanId} enabled={stripeReady()} owner={membership.role === WorkspaceRole.OWNER} /><p className="wt-muted mt-6">US$29 per month. Payment is required before building. Cancel renewal at any time through Manage payment, invoices & cancellation; access continues through the paid period.</p></>}
    {membership.role === WorkspaceRole.OWNER && <PaymentHistory workspaceId={workspace.id} after={query.after} basePath="/billing" />}
    <section className="wt-card mt-6"><h2>Payment and data protection</h2><p className="mt-3">Failed renewal: 7 days of full access, then the website stays live through day 30 while editor and AI access are restricted. After 30 days unpaid or when cancellation takes effect, hosting is temporarily suspended. Your website and data are retained for 90 days after suspension so you can reactivate. Permanent deletion may be reviewed after multiple warnings, subject to legal requirements. <Link href="/terms">Read our terms →</Link></p></section>
  </AppShell>
}
