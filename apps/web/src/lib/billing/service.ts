import { INDIVIDUAL_PLAN_SLUG, individualPriceFilter } from './catalog'
import { prisma } from '@awb/database'
import type Stripe from 'stripe'
import { stripeClient } from './stripe'
import { appUrl } from '../account-security'
import { queueBillingNotices } from './notifications'
import { queuePaymentEmail, queueSubscriptionEmail, queueTrialEmail } from '../transactional-email'
import { billingLifecycle, TRIAL_DAYS } from '@awb/database/billing-policy'
import { confirmedCheckoutSubscription } from './checkout-result'

export async function confirmWorkspaceCheckout(workspaceId: string) {
  const workspace = await prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId } })
  if (!workspace.checkoutSessionId) return
  const stripe = stripeClient()
  const session = await stripe.checkout.sessions.retrieve(workspace.checkoutSessionId)
  const subscriptionId = confirmedCheckoutSubscription(session, workspace)
  if (subscriptionId) await syncSubscription(workspaceId, subscriptionId, undefined, stripe)
}

export async function checkout(workspaceId: string, priceId: string, email: string, stripe = stripeClient()) {
  return prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT "id" FROM "Workspace" WHERE "id" = ${workspaceId} FOR UPDATE`
    const workspace = await tx.workspace.findUniqueOrThrow({ where: { id: workspaceId } })
    if (workspace.status !== 'ACTIVE') throw new Error('This workspace is suspended. Contact support.')
    const price = await tx.billingPrice.findUnique({ where: { id: priceId }, include: { plan: true } })
    if (!price?.active || !price.plan.active || price.plan.slug !== INDIVIDUAL_PLAN_SLUG || price.amount !== individualPriceFilter.amount || price.currency !== individualPriceFilter.currency || price.interval !== individualPriceFilter.interval) throw new Error('This plan is not available for purchase.')
    if (await tx.project.count({ where: { workspaceId } }) > price.plan.websiteLimit) throw new Error('This plan has fewer websites than your workspace uses.')
    let customer = workspace.stripeCustomerId
    if (!customer) {
      const created = await stripe.customers.create({ email, name: workspace.name, metadata: { workspaceId } }, { idempotencyKey: `workspace-customer-${workspaceId}` })
      customer = created.id
      await tx.workspace.update({ where: { id: workspaceId }, data: { stripeCustomerId: customer } })
    }
    // Stripe is authoritative even if a webhook is still in transit.
    const subscriptions = await stripe.subscriptions.list({ customer, status: 'all', limit: 100 })
    if (subscriptions.has_more) throw new Error('Your subscription history needs review. Contact support before starting another subscription.')
    const existing = subscriptions.data.find(sub => !['canceled', 'incomplete_expired'].includes(sub.status))
    if (existing) {
      const session = await stripe.billingPortal.sessions.create({ customer, return_url: `${appUrl()}/billing`, ...(process.env.STRIPE_PORTAL_CONFIGURATION_ID ? { configuration: process.env.STRIPE_PORTAL_CONFIGURATION_ID } : {}) })
      return session.url
    }
    await tx.$queryRaw`SELECT "id" FROM "User" WHERE "email" = ${email} FOR UPDATE`
    const buyer = await tx.user.findUniqueOrThrow({ where: { email } })
    const previousAccess = await tx.workspaceMember.count({ where: { userId: buyer.id, role: 'OWNER', workspace: { OR: [{ billingTrialUsedAt: { not: null } }, { billingPaidThrough: { not: null } }] } } })
    const trialEligible = !workspace.billingExempt && !workspace.billingTrialUsedAt && !workspace.billingPaidThrough && !buyer.billingTrialUsedAt && !previousAccess && !subscriptions.data.some(sub => !!sub.trial_start)
    let expiredTrialCheckout = false
    if (workspace.checkoutSessionId && workspace.checkoutExpiresAt && workspace.checkoutExpiresAt > new Date()) {
      const pending = await stripe.checkout.sessions.retrieve(workspace.checkoutSessionId)
      if (pending.status === 'open' && pending.url) {
        if (pending.metadata?.priceId === price.id && pending.allow_promotion_codes && pending.metadata?.trialPolicy === '7-days-v1' && (pending.metadata.trialGranted !== 'true' || trialEligible)) return pending.url
        await stripe.checkout.sessions.expire(pending.id)
        expiredTrialCheckout = pending.metadata?.trialGranted === 'true'
      }
      if (pending.status === 'complete') {
        const previousId = objectId(pending.subscription)
        const previous = subscriptions.data.find(sub => sub.id === previousId)
        if (!previous || !['canceled', 'incomplete_expired'].includes(previous.status)) throw new Error('Your payment is being confirmed. Refresh billing in a moment.')
      }
    }
    if (trialEligible && buyer.billingTrialReservedUntil && buyer.billingTrialReservedUntil > new Date() && !expiredTrialCheckout) throw new Error('Your free-trial checkout is already open. Complete it or wait until it expires before starting another.')
    const trialGranted = trialEligible && (expiredTrialCheckout || !buyer.billingTrialReservedUntil || buyer.billingTrialReservedUntil <= new Date())
    const session = await stripe.checkout.sessions.create({ mode: 'subscription', allow_promotion_codes: true, payment_method_collection: 'always', payment_method_types: ['card'], custom_text: { submit: { message: trialGranted ? '7 days free, then US$29 per month. Your card is collected today and automatically charged when the trial ends unless you cancel beforehand. One trial per customer.' : 'US$29 per month. Payment is required to reactivate. Previous trial customers do not receive another free trial. Cancel renewal anytime through Plans & billing.' } }, customer, client_reference_id: workspaceId, line_items: [{ price: price.stripePriceId, quantity: 1 }], success_url: `${appUrl()}/billing?checkout=success`, cancel_url: `${appUrl()}/billing?checkout=cancelled`, expires_at: Math.floor(Date.now() / 1000) + 1800, metadata: { workspaceId, priceId: price.id, trialPolicy: '7-days-v1', trialGranted: String(trialGranted) }, subscription_data: { metadata: { workspaceId }, ...(trialGranted ? { trial_period_days: TRIAL_DAYS, trial_settings: { end_behavior: { missing_payment_method: 'cancel' as const } } } : {}) }, billing_address_collection: 'auto' })
    if (!session.url) throw new Error('Stripe did not create a checkout page. Please try again.')
    await tx.workspace.update({ where: { id: workspaceId }, data: { checkoutSessionId: session.id, checkoutExpiresAt: new Date(session.expires_at * 1000) } })
    if (trialGranted) await tx.user.update({ where: { id: buyer.id }, data: { billingTrialReservedUntil: new Date(session.expires_at * 1000) } })
    return session.url
  }, { timeout: 60000, maxWait: 10000 })
}
export async function billingPortal(workspaceId: string) {
  const workspace = await prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId } })
  if (!workspace.stripeCustomerId) throw new Error('Choose a plan before opening billing management.')
  return (await stripeClient().billingPortal.sessions.create({ customer: workspace.stripeCustomerId, return_url: `${appUrl()}/billing`, ...(process.env.STRIPE_PORTAL_CONFIGURATION_ID ? { configuration: process.env.STRIPE_PORTAL_CONFIGURATION_ID } : {}) })).url
}

export function subscriptionState(subscription: Stripe.Subscription, planId: string | null) {
  const periods = subscription.items.data.map(item => item.current_period_end)
  const end = periods.length ? Math.min(...periods) : 0
  return { stripeSubscriptionId: subscription.id, billingPlanId: planId, billingStatus: planId && subscription.items.data.length === 1 && subscription.items.data[0]!.quantity === 1 ? subscription.status : 'unmapped', billingPeriodEnd: end ? new Date(end * 1000) : null, cancelAtPeriodEnd: subscription.cancel_at_period_end }
}

const objectId = (value: unknown): string | undefined => typeof value === 'string' ? value : value && typeof value === 'object' && 'id' in value && typeof value.id === 'string' ? value.id : undefined
export async function syncSubscription(workspaceId: string, subscriptionId: string, event?: Stripe.Event, client: Pick<Stripe, 'subscriptions' | 'invoices'> = stripeClient()) {
  return prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT "id" FROM "Workspace" WHERE "id" = ${workspaceId} FOR UPDATE`
    if (event && await tx.billingEvent.findUnique({ where: { id: event.id } })) return
    const current = await tx.workspace.findUniqueOrThrow({ where: { id: workspaceId } })
    const subscription = await client.subscriptions.retrieve(subscriptionId, { expand: ['latest_invoice'] })
    if (objectId(subscription.customer) !== current.stripeCustomerId) throw new Error('Subscription customer mismatch')
    const replacing = !!current.stripeSubscriptionId && current.stripeSubscriptionId !== subscription.id
    let replacementAllowed = ['canceled', 'incomplete_expired', 'none'].includes(current.billingStatus)
    if (replacing && !replacementAllowed && !['canceled', 'incomplete_expired'].includes(subscription.status)) {
      // A new checkout can finish before the old cancellation webhook arrives.
      const previous = await client.subscriptions.retrieve(current.stripeSubscriptionId!)
      if (objectId(previous.customer) !== current.stripeCustomerId) throw new Error('Previous subscription customer mismatch')
      replacementAllowed = ['canceled', 'incomplete_expired'].includes(previous.status)
    }
    if (replacing && (['canceled', 'incomplete_expired'].includes(subscription.status) || !replacementAllowed)) {
      if (event) await tx.billingEvent.create({ data: { id: event.id, type: event.type } })
      return
    }
    const price = await tx.billingPrice.findUnique({ where: { stripePriceId: subscription.items.data[0]?.price.id ?? '' } })
    const validPrice = price && price.amount === individualPriceFilter.amount && price.currency === individualPriceFilter.currency && price.interval === individualPriceFilter.interval
    const state = subscriptionState(subscription, validPrice ? price.planId : null)
    const invoice = typeof subscription.latest_invoice === 'object' ? subscription.latest_invoice : null
    let paidThrough = replacing ? null : current.billingPaidThrough
    const trialEnd = subscription.trial_end ? new Date(subscription.trial_end * 1000) : null
    const isTrialInvoice = (item: Stripe.Invoice) => subscription.status === 'trialing' || !!subscription.trial_end && item.created < subscription.trial_end
    if (invoice?.status === 'paid' && !isTrialInvoice(invoice)) {
      const end = Math.max(0, ...invoice.lines.data.filter(line => line.parent?.type === 'subscription_item_details' && line.pricing?.price_details?.price === subscription.items.data[0]?.price.id).map(line => line.period.end))
      if (end && (!paidThrough || end * 1000 > paidThrough.getTime())) paidThrough = new Date(end * 1000)
    }
    // Initial failed checkout never grants a grace period. Only previously paid accounts get it.
    const openInvoices = await client.invoices.list({ customer: current.stripeCustomerId!, subscription: subscription.id, status: 'open', limit: 100 })
    if (openInvoices.has_more) throw new Error('Invoice history needs reconciliation before access can be restored')
    const outstanding = openInvoices.data.filter(item => item.attempted).sort((a, b) => a.created - b.created)[0]
    if (outstanding && state.billingStatus === 'active') state.billingStatus = 'past_due'
    const recovered = !outstanding && state.billingStatus === 'active' && !!paidThrough && paidThrough > new Date() && invoice?.status === 'paid'
    const trialActive = state.billingStatus === 'trialing' && !!trialEnd && trialEnd > new Date()
    const delinquent = ['past_due', 'unpaid'].includes(state.billingStatus) || subscription.cancellation_details?.reason === 'payment_failed' || state.billingStatus === 'incomplete' && !!invoice?.attempted && invoice.status === 'open'
    const since = recovered ? null : delinquent ? (replacing ? null : current.billingDelinquentSince) ?? new Date((outstanding?.created ?? invoice?.created ?? event?.created ?? Math.floor(Date.now() / 1000)) * 1000) : current.billingDelinquentSince
    const workspace = await tx.workspace.update({ where: { id: workspaceId }, data: {
      ...state, billingPaidThrough: paidThrough, billingDelinquentSince: since, billingTrialEnd: trialEnd,
      ...(subscription.trial_start ? { billingTrialUsedAt: current.billingTrialUsedAt ?? new Date(subscription.trial_start * 1000) } : {}),
      billingNextRetryAt: (outstanding ?? invoice)?.next_payment_attempt ? new Date((outstanding ?? invoice)!.next_payment_attempt! * 1000) : null,
      billingCancellationReason: subscription.cancellation_details?.reason ?? null,
      billingSubscriptionEndedAt: subscription.ended_at ? new Date(subscription.ended_at * 1000) : null,
      billingLastReconciledAt: new Date(),
      ...(recovered || trialActive ? { billingSuspendedAt: null, billingRetentionEndsAt: null, billingDeletionEligibleAt: null } : {}),
    } })
    if (subscription.trial_start) await tx.user.updateMany({ where: { billingTrialUsedAt: null, memberships: { some: { workspaceId, role: 'OWNER' } } }, data: { billingTrialUsedAt: new Date(subscription.trial_start * 1000), billingTrialReservedUntil: null } })
    if (trialActive) {
      await tx.billingNotice.updateMany({ where: { workspaceId, status: 'PENDING' }, data: { status: 'SKIPPED' } })
      await queueTrialEmail(tx, workspace, subscription.id)
    }
    if (recovered) {
      await tx.billingNotice.updateMany({ where: { workspaceId, status: 'PENDING' }, data: { status: 'SKIPPED' } })
      await tx.emailContact.updateMany({ where: { convertedAt: null, user: { memberships: { some: { workspaceId, role: 'OWNER' } } } }, data: { convertedAt: new Date() } })
    }
    await queueBillingNotices(tx, workspace)
    const paidInvoice = event?.type === 'invoice.paid' ? await client.invoices.retrieve((event.data.object as Stripe.Invoice).id) : invoice
    if (paidInvoice && !isTrialInvoice(paidInvoice)) await queuePaymentEmail(tx, workspace, paidInvoice)
    const audit = await tx.auditEvent.create({ data: { workspaceId, action: 'billing.subscription.sync', targetType: 'Subscription', targetId: subscription.id, metadata: { status: subscription.status, ...(event ? { eventId: event.id } : {}), source: event ? 'webhook' : 'reconciliation' } } })
    if (state.cancelAtPeriodEnd && (!current.cancelAtPeriodEnd || replacing)) await queueSubscriptionEmail(tx, workspace, 'CANCELLATION', audit.id)
    else if (!replacing && current.cancelAtPeriodEnd && !state.cancelAtPeriodEnd && !['canceled', 'incomplete_expired'].includes(subscription.status) && !!state.billingPeriodEnd && state.billingPeriodEnd > new Date()) await queueSubscriptionEmail(tx, workspace, 'RESUMED', audit.id)
    if (recovered && (current.billingPaidThrough || replacing && current.billingTrialUsedAt) && (replacing || !billingLifecycle(current).editing)) await queueSubscriptionEmail(tx, workspace, 'REACTIVATED', audit.id)
    if (event) await tx.billingEvent.create({ data: { id: event.id, type: event.type } })
  }, { timeout: 45000, maxWait: 10000 })
}
export async function processBillingEvent(event: Stripe.Event) {
  if (!event.type.startsWith('customer.subscription.') && !['checkout.session.completed', 'checkout.session.async_payment_succeeded', 'invoice.payment_failed', 'invoice.payment_action_required', 'invoice.paid', 'invoice.updated'].includes(event.type)) return
  const object = event.data.object as unknown as { id: string; customer?: unknown; subscription?: unknown; parent?: { subscription_details?: { subscription?: unknown } } }
  const customerId = objectId(object.customer)
  const subscriptionId = event.type.startsWith('customer.subscription.') ? object.id : objectId(object.parent?.subscription_details?.subscription ?? object.subscription)
  if (!customerId || !subscriptionId) return
  const workspace = await prisma.workspace.findUnique({ where: { stripeCustomerId: customerId }, select: { id: true } })
  if (workspace) await syncSubscription(workspace.id, subscriptionId, event)
}
