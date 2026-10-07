import { INDIVIDUAL_PLAN_SLUG, INDIVIDUAL_AMOUNT, INDIVIDUAL_CURRENCY, INDIVIDUAL_FEATURE_GROUPS, individualPriceFilter } from '@/lib/billing/catalog'
import Link from 'next/link'
import type { BillingPlan, BillingPrice } from '@awb/database'
import { money } from '@/lib/billing/access'
import { openCheckout } from '@/app/actions/billing'
import { ActionForm } from './action-form'

export function PlanCards({ plans, signedIn = false, currentPlanId, enabled = false, owner = true, reactivating = false, trialEligible = false }: { plans: Array<BillingPlan & { prices: BillingPrice[] }>; signedIn?: boolean; currentPlanId?: string | null; enabled?: boolean; owner?: boolean; reactivating?: boolean; trialEligible?: boolean }) {
  return <div className="wt-plan-grid" style={{ gridTemplateColumns: 'minmax(0, 1fr)' }}>{plans.filter(plan => plan.slug === INDIVIDUAL_PLAN_SLUG).map(plan => {
    const price = plan.prices.find(price => price.active && price.amount === individualPriceFilter.amount && price.currency === individualPriceFilter.currency && price.interval === individualPriceFilter.interval)
    return <article key={plan.id} className="wt-plan">
      <div className="wt-plan-tag">{currentPlanId === plan.id ? 'YOUR PLAN' : 'INDIVIDUAL PLAN'}</div>
      <h2>{trialEligible || !signedIn ? '7 Days Free. Full Access.' : 'Everything Included for $29/Month'}</h2>
      <p className="wt-muted">One website. Eligible new customers get full access free for 7 days, then automatic US$29/month billing. Card required. Cancel before the trial ends to avoid the first charge.</p>
      <div className="wt-price"><strong>{money(INDIVIDUAL_AMOUNT, INDIVIDUAL_CURRENCY)}</strong><span>/month · USD</span></div>
      <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2 xl:grid-cols-3">{INDIVIDUAL_FEATURE_GROUPS.map(group => <section key={group.title} aria-label={group.title}>
        <h3 className="font-semibold">{group.title}</h3>
        <ul>{group.features.map(feature => <li key={feature} className="flex gap-2"><span aria-hidden="true" className="text-emerald-700">✓</span><span>{feature}</span></li>)}</ul>
      </section>)}</div>
      {signedIn ? <ActionForm action={openCheckout} label={reactivating ? 'Reactivate subscription' : trialEligible ? 'Start 7-day free trial' : currentPlanId === plan.id ? 'Resolve payment' : 'Choose Individual · $29/month'} disabled={!enabled || !owner || !price}>
        <input type="hidden" name="priceId" value={price?.id ?? ''} />
        <p className="wt-muted">{trialEligible ? '7 days free, then US$29/month. Card required. Cancel before the trial ends to avoid the first charge.' : 'US$29 per month · monthly billing only.'}</p>
        {!owner && <small>Only a workspace owner can manage billing.</small>}
      </ActionForm> : <Link href="/signup" className="wt-button">Start 7-day free trial →</Link>}
    </article>
  })}</div>
}
