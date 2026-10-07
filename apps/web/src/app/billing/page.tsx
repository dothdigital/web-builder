import { INDIVIDUAL_PLAN_SLUG, individualPriceFilter } from '@/lib/billing/catalog'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { prisma, WorkspaceRole } from '@awb/database'
import { requirePageUser, primaryWorkspace, requireWorkspace } from '@/lib/tenancy'
import { billingLifecycle } from '@/lib/billing/access'
import { stripeReady } from '@/lib/billing/stripe'
import { AppShell } from '@/components/account/app-shell'
import { PlanCards } from '@/components/account/plan-cards'
import { BillingManagement } from '@/components/account/billing-management'
import { PaymentHistory } from '@/components/account/payment-history'
import { confirmWorkspaceCheckout } from '@/lib/billing/service'
export default async function BillingPage({ searchParams }: { searchParams: Promise<{ checkout?: string; updated?: string; reason?: string; after?: string; setup_intent?: string }> }) {
  const user = await requirePageUser(); const base = await primaryWorkspace(user.id); if (!base) return null
  const { membership } = await requireWorkspace(base.id)
  const query = await searchParams
  let confirmationFailed = false
  if (query.checkout === 'success' && stripeReady()) {
    try { await confirmWorkspaceCheckout(base.id) }
    catch { confirmationFailed = true }
  }
  const workspace = await prisma.workspace.findUniqueOrThrow({ where: { id: base.id }, include: { billingPlan: true, _count: { select: { projects: true } } } })
  const plans = await prisma.billingPlan.findMany({ where: { active: true, slug: INDIVIDUAL_PLAN_SLUG }, include: { prices: { where: individualPriceFilter } } })
  const state = billingLifecycle(workspace)
  const buyer = await prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { billingTrialUsedAt: true } })
  const trialEligible = !buyer.billingTrialUsedAt && !workspace.billingTrialUsedAt && !workspace.billingPaidThrough && !workspace.stripeSubscriptionId
  const staff = user.isPlatformAdmin || user.isPlatformSupport
  const ended = !!workspace.stripeSubscriptionId && ['canceled', 'incomplete_expired'].includes(workspace.billingStatus)
  const cancellationScheduled = workspace.cancelAtPeriodEnd && !ended
  const resumeAvailable = cancellationScheduled && ['active', 'trialing'].includes(workspace.billingStatus) && !!workspace.billingPeriodEnd && workspace.billingPeriodEnd > new Date()
  if (query.checkout === 'success' && state.editing) redirect('/dashboard')
  const labels = { TRIAL: '7-day free trial — full access', ACTIVE: workspace.billingPlan?.name ?? 'Full access', GRACE: 'Payment grace period', PAST_DUE: 'Payment overdue — editing restricted', SUSPENDED: 'Website temporarily suspended', PAYMENT_REQUIRED: 'Payment required before building' }
  return <AppShell title="Plans & billing" active="/billing">
    <div className="wt-heading"><p className="wt-eyebrow">INDIVIDUAL PLAN</p><h1>{trialEligible && !staff && !workspace.billingExempt ? 'Start Your 7-Day Free Trial' : 'Plans & billing'}</h1><p>Individual · 1 website · Full access free for 7 days for eligible new customers, then automatic US$29/month billing. Card required.</p></div>
    {trialEligible && !staff && !workspace.billingExempt && <section className="wt-notice" aria-label="Free trial and automatic billing"><h2 className="text-xl font-semibold">7 days free with full access</h2><p>Add your card at secure checkout to activate your trial. Your saved card will be charged automatically at US$29/month after 7 days, unless you cancel before the trial ends. No first subscription charge if you cancel in time. One trial per eligible new customer.</p></section>}
    {(query.checkout === 'success' || query.updated) && <div className="wt-notice">{confirmationFailed ? 'We could not confirm your payment yet. Please refresh the status; do not pay again.' : 'Your subscription is being confirmed with Stripe. Access opens after your trial or payment is confirmed.'} <Link href="/billing?checkout=success">Refresh status →</Link></div>}
    {query.checkout === 'cancelled' && <div className="wt-notice">Checkout was cancelled. Your subscription has not changed.</div>}
    <section className="wt-billing-summary wt-card"><div><p className="wt-eyebrow">CURRENT ACCESS</p><h2>{staff ? 'Admin and support — no payment required' : workspace.billingExempt ? 'Payment skipped — full access' : cancellationScheduled ? state.phase === 'TRIAL' ? 'Subscription cancelled — trial access continues' : 'Subscription renewal cancelled' : labels[state.phase]}</h2><p className="wt-muted">{workspace._count.projects} websites · {workspace.billingExempt ? 'Full access without payment' : '1 website included with Individual'}</p>
      {cancellationScheduled && state.phase !== 'TRIAL' && <p>Automatic renewal is turned off. {workspace.billingStatus === 'active' && workspace.billingPaidThrough ? `Access continues until ${workspace.billingPaidThrough.toLocaleDateString('en-US', { timeZone: 'UTC' })}.` : 'Existing payment restrictions still apply.'}</p>}
      {state.phase === 'TRIAL' && workspace.billingTrialEnd && <p>{cancellationScheduled ? 'Your subscription is scheduled to end on ' : 'Your trial ends on '}{workspace.billingTrialEnd.toLocaleString('en-US', { timeZone: 'UTC', dateStyle: 'long', timeStyle: 'short' })} UTC. {cancellationScheduled ? 'You keep full trial access until then. Automatic billing is turned off, and your card will not be charged unless you resume your subscription before that date.' : 'Your saved card will then be billed at US$29/month, subject to your checkout discount. Cancel before the trial ends to avoid the first charge.'}</p>}
      {state.phase === 'GRACE' && <p>Your website and editor remain fully available for 7 days after the failed renewal. Update your payment method to keep access.</p>}
      {state.phase === 'PAST_DUE' && <p>Your website remains live through day 30 after the failed renewal. Editing, AI and content generation are restricted until payment is resolved.</p>}
      {state.phase === 'SUSPENDED' && <p>Visitors see a neutral temporary page. Your website and data are preserved. Reactivate your subscription to restore access.</p>}
      {workspace.billingRetentionEndsAt && <p>Data retained until at least {workspace.billingRetentionEndsAt.toLocaleDateString('en-US')}. Multiple warnings are sent before any permanent deletion review.</p>}
      {workspace.billingNextRetryAt && <p>Stripe’s next scheduled payment attempt: {workspace.billingNextRetryAt.toLocaleDateString('en-US')}.</p>}
      {state.phase === 'PAYMENT_REQUIRED' && !staff && <p>Activate your eligible free trial or paid subscription through secure checkout to create and edit your website. Existing saved work is preserved.</p>}
    </div>{!staff && !workspace.billingExempt && workspace.stripeCustomerId && membership.role === WorkspaceRole.OWNER && <BillingManagement initialSetupId={query.setup_intent} initialResumeAvailable={resumeAvailable} />}</section>
    {!stripeReady() && !staff && <div className="wt-notice">Payments are temporarily unavailable. Contact support@webtummy.com.</div>}
    {!staff && !workspace.billingExempt && (ended || state.phase !== 'ACTIVE' && state.phase !== 'TRIAL' && state.phase !== 'GRACE') && <section id="reactivate-plan">{ended && <div className="wt-notice">Reactivate with the same account and workspace. Checkout starts a new subscription after confirmation. Your retained website content is preserved, and previously published hosting is restored automatically. You can enter an eligible promotion code at checkout.</div>}<PlanCards plans={plans} signedIn currentPlanId={workspace.billingPlanId} reactivating={ended} trialEligible={trialEligible} enabled={stripeReady() && query.checkout !== 'success'} owner={membership.role === WorkspaceRole.OWNER} /><p className="wt-muted mt-6">7 days free for eligible new customers, then US$29 per month. Card required. Returning customers subscribe without another trial. Cancel renewal at any time through Manage payment, invoices & cancellation; access continues through the paid period.</p></section>}
    {membership.role === WorkspaceRole.OWNER && <div id="billing-payment-history"><PaymentHistory workspaceId={workspace.id} after={query.after} basePath="/billing" /></div>}
    <section className="wt-card mt-6"><h2>Payment and data protection</h2><p className="mt-3">Trial: full access for 7 days; a failed first charge requires payment before access can continue. Failed renewal for previously paid customers: 7 days of full access, then the website stays live through day 30 while editor and AI access are restricted. After 30 days unpaid or when cancellation takes effect, hosting is temporarily suspended. Your website and data are retained for 90 days after suspension so you can reactivate. Permanent deletion may be reviewed after multiple warnings, subject to legal requirements. <Link href="/terms">Read our terms →</Link></p></section>
  </AppShell>
}
