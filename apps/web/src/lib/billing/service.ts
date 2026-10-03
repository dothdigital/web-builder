import { prisma } from '@awb/database'
import type Stripe from 'stripe'
import { stripeClient } from './stripe'
import { appUrl } from '../account-security'

export async function checkout(workspaceId: string, priceId: string, email: string) {
  const stripe = stripeClient()
  return prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT "id" FROM "Workspace" WHERE "id" = ${workspaceId} FOR UPDATE`
    const workspace = await tx.workspace.findUniqueOrThrow({ where: { id: workspaceId } })
    if (workspace.status !== 'ACTIVE') throw new Error('This workspace is suspended. Contact support.')
    const price = await tx.billingPrice.findUnique({ where: { id: priceId }, include: { plan: true } })
    if (!price?.active || !price.plan.active) throw new Error('This plan is not available for purchase.')
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
      if (!['active', 'trialing'].includes(existing.status)) throw new Error('Resolve the existing subscription payment in Manage billing first.')
      if (existing.items.data.length !== 1) throw new Error('This subscription needs support before changing plans.')
      const session = await stripe.billingPortal.sessions.create({ customer, return_url: `${appUrl()}/billing`, ...(process.env.STRIPE_PORTAL_CONFIGURATION_ID ? { configuration: process.env.STRIPE_PORTAL_CONFIGURATION_ID } : {}), flow_data: { type: 'subscription_update_confirm', subscription_update_confirm: { subscription: existing.id, items: [{ id: existing.items.data[0]!.id, price: price.stripePriceId, quantity: 1 }] }, after_completion: { type: 'redirect', redirect: { return_url: `${appUrl()}/billing?updated=1` } } } })
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
    const session = await stripe.checkout.sessions.create({ mode: 'subscription', customer, client_reference_id: workspaceId, line_items: [{ price: price.stripePriceId, quantity: 1 }], success_url: `${appUrl()}/billing?checkout=success`, cancel_url: `${appUrl()}/billing?checkout=cancelled`, expires_at: Math.floor(Date.now() / 1000) + 1800, metadata: { workspaceId, priceId: price.id }, subscription_data: { metadata: { workspaceId } }, billing_address_collection: 'auto' })
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
export async function processBillingEvent(event: Stripe.Event) {
  if (!event.type.startsWith('customer.subscription.') && event.type !== 'checkout.session.completed' && event.type !== 'checkout.session.async_payment_succeeded') return
  const object = event.data.object as unknown as { id: string; customer: string | { id: string } | null; subscription?: string | { id: string } | null }
  const customerId = typeof object.customer === 'string' ? object.customer : object.customer?.id
  const subscriptionId = event.type.startsWith('customer.subscription.') ? object.id : typeof object.subscription === 'string' ? object.subscription : object.subscription?.id
  if (!customerId || !subscriptionId) return
  const workspace = await prisma.workspace.findUnique({ where: { stripeCustomerId: customerId }, select: { id: true } })
  if (!workspace) return
  await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT "id" FROM "Workspace" WHERE "id" = ${workspace.id} FOR UPDATE`
    if (await tx.billingEvent.findUnique({ where: { id: event.id } })) return
    const current = await tx.workspace.findUniqueOrThrow({ where: { id: workspace.id } })
    // Retrieve under the workspace lock: delayed/reordered events cannot rewind state.
    const subscription = await stripeClient().subscriptions.retrieve(subscriptionId)
    const relatedCustomer = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id
    if (relatedCustomer !== customerId) throw new Error('Subscription customer mismatch')
    if (!current.stripeSubscriptionId || current.stripeSubscriptionId === subscription.id || !['canceled', 'incomplete_expired'].includes(subscription.status) && ['canceled', 'incomplete_expired', 'none'].includes(current.billingStatus)) {
      const price = await tx.billingPrice.findUnique({ where: { stripePriceId: subscription.items.data[0]?.price.id ?? '' } })
      const state = subscriptionState(subscription, price?.planId ?? null)
      await tx.workspace.update({ where: { id: workspace.id }, data: state })
      if (state.billingStatus === 'active') await tx.emailContact.updateMany({ where: { convertedAt: null, user: { memberships: { some: { workspaceId: workspace.id, role: 'OWNER' } } } }, data: { convertedAt: new Date() } })
      await tx.auditEvent.create({ data: { workspaceId: workspace.id, action: 'billing.subscription.sync', targetType: 'Subscription', targetId: subscription.id, metadata: { status: subscription.status, eventId: event.id } } })
    }
    await tx.billingEvent.create({ data: { id: event.id, type: event.type } })
  }, { timeout: 45000, maxWait: 10000 })
}
