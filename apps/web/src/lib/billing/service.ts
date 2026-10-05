import { INDIVIDUAL_PLAN_SLUG, individualPriceFilter } from './catalog'
import { prisma } from '@awb/database'
import type Stripe from 'stripe'
import { stripeClient } from './stripe'
import { appUrl } from '../account-security'
import { queueBillingNotices } from './notifications'

export async function checkout(workspaceId: string, priceId: string, email: string) {
  const stripe = stripeClient()
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
    const existing = subscriptions.data.find(sub => !['canceled', 'incomplete_expired'].includes(sub.status))
    if (existing) {
      const session = await stripe.billingPortal.sessions.create({ customer, return_url: `${appUrl()}/billing`, ...(process.env.STRIPE_PORTAL_CONFIGURATION_ID ? { configuration: process.env.STRIPE_PORTAL_CONFIGURATION_ID } : {}) })
      return session.url
    }
    if (workspace.checkoutSessionId && workspace.checkoutExpiresAt && workspace.checkoutExpiresAt > new Date()) {
      const pending = await stripe.checkout.sessions.retrieve(workspace.checkoutSessionId)
      if (pending.status === 'open' && pending.url) {
        if (pending.metadata?.priceId === price.id) return pending.url
        await stripe.checkout.sessions.expire(pending.id)
      }
      if (pending.status === 'complete') throw new Error('Your payment is being confirmed. Refresh billing in a moment.')
    }
    const session = await stripe.checkout.sessions.create({ mode: 'subscription', payment_method_collection: 'always', payment_method_types: ['card'], custom_text: { submit: { message: 'US$29 per month. No free trial. Cancel renewal at any time through Webtummy Plans & billing. Access continues until the end of the paid period.' } }, customer, client_reference_id: workspaceId, line_items: [{ price: price.stripePriceId, quantity: 1 }], success_url: `${appUrl()}/billing?checkout=success`, cancel_url: `${appUrl()}/billing?checkout=cancelled`, expires_at: Math.floor(Date.now() / 1000) + 1800, metadata: { workspaceId, priceId: price.id }, subscription_data: { metadata: { workspaceId } }, billing_address_collection: 'auto' })
    if (!session.url) throw new Error('Stripe did not create a checkout page. Please try again.')
    await tx.workspace.update({ where: { id: workspaceId }, data: { checkoutSessionId: session.id, checkoutExpiresAt: new Date(session.expires_at * 1000) } })
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
    if (replacing && (['canceled', 'incomplete_expired'].includes(subscription.status) || !['canceled', 'incomplete_expired', 'none'].includes(current.billingStatus))) {
      if (event) await tx.billingEvent.create({ data: { id: event.id, type: event.type } })
      return
    }
    const price = await tx.billingPrice.findUnique({ where: { stripePriceId: subscription.items.data[0]?.price.id ?? '' } })
    const validPrice = price && price.amount === individualPriceFilter.amount && price.currency === individualPriceFilter.currency && price.interval === individualPriceFilter.interval
    const state = subscriptionState(subscription, validPrice ? price.planId : null)
    const invoice = typeof subscription.latest_invoice === 'object' ? subscription.latest_invoice : null
    let paidThrough = replacing ? null : current.billingPaidThrough
    if (invoice?.status === 'paid') {
      const end = Math.max(0, ...invoice.lines.data.filter(line => line.parent?.type === 'subscription_item_details' && line.pricing?.price_details?.price === subscription.items.data[0]?.price.id).map(line => line.period.end))
      if (end && (!paidThrough || end * 1000 > paidThrough.getTime())) paidThrough = new Date(end * 1000)
    }
    // Initial failed checkout never grants a grace period. Only previously paid accounts get it.
    const openInvoices = await client.invoices.list({ customer: current.stripeCustomerId!, subscription: subscription.id, status: 'open', limit: 100 })
    if (openInvoices.has_more) throw new Error('Invoice history needs reconciliation before access can be restored')
    const outstanding = openInvoices.data.filter(item => item.attempted).sort((a, b) => a.created - b.created)[0]
    if (outstanding && state.billingStatus === 'active') state.billingStatus = 'past_due'
    const recovered = !outstanding && state.billingStatus === 'active' && !!paidThrough && paidThrough > new Date() && invoice?.status === 'paid'
    const delinquent = ['past_due', 'unpaid'].includes(state.billingStatus) || subscription.cancellation_details?.reason === 'payment_failed' || state.billingStatus === 'incomplete' && !!invoice?.attempted && invoice.status === 'open'
    const since = recovered ? null : delinquent ? (replacing ? null : current.billingDelinquentSince) ?? new Date((outstanding?.created ?? invoice?.created ?? event?.created ?? Math.floor(Date.now() / 1000)) * 1000) : current.billingDelinquentSince
    const workspace = await tx.workspace.update({ where: { id: workspaceId }, data: {
      ...state, billingPaidThrough: paidThrough, billingDelinquentSince: since,
      billingNextRetryAt: (outstanding ?? invoice)?.next_payment_attempt ? new Date((outstanding ?? invoice)!.next_payment_attempt! * 1000) : null,
      billingCancellationReason: subscription.cancellation_details?.reason ?? null,
      billingSubscriptionEndedAt: subscription.ended_at ? new Date(subscription.ended_at * 1000) : null,
      billingLastReconciledAt: new Date(),
      ...(recovered ? { billingSuspendedAt: null, billingRetentionEndsAt: null, billingDeletionEligibleAt: null } : {}),
    } })
    if (recovered) {
      await tx.billingNotice.updateMany({ where: { workspaceId, status: 'PENDING' }, data: { status: 'SKIPPED' } })
      await tx.emailContact.updateMany({ where: { convertedAt: null, user: { memberships: { some: { workspaceId, role: 'OWNER' } } } }, data: { convertedAt: new Date() } })
    }
    await queueBillingNotices(tx, workspace)
    await tx.auditEvent.create({ data: { workspaceId, action: 'billing.subscription.sync', targetType: 'Subscription', targetId: subscription.id, metadata: { status: subscription.status, ...(event ? { eventId: event.id } : {}), source: event ? 'webhook' : 'reconciliation' } } })
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
