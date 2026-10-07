import type Stripe from 'stripe'
import { stripeClient } from './stripe'

export type BillingWorkspace = { id: string; stripeCustomerId: string | null; stripeSubscriptionId: string | null; billingStatus?: string }
const id = (value: string | { id: string } | null) => typeof value === 'string' ? value : value?.id

async function ownedSubscription(workspace: BillingWorkspace, stripe: Stripe) {
  if (!workspace.stripeCustomerId || !workspace.stripeSubscriptionId) throw new Error('No subscription found.')
  const subscription = await stripe.subscriptions.retrieve(workspace.stripeSubscriptionId)
  if (id(subscription.customer) !== workspace.stripeCustomerId) throw new Error('Subscription access denied.')
  return subscription
}

export async function billingManagementSummary(workspace: BillingWorkspace, stripe = stripeClient()) {
  const subscription = await ownedSubscription(workspace, stripe)
  const customer = await stripe.customers.retrieve(workspace.stripeCustomerId!)
  if (customer.deleted) throw new Error('Customer unavailable.')
  const methodId = id(subscription.default_payment_method) || id(customer.invoice_settings.default_payment_method)
  const method = methodId ? await stripe.paymentMethods.retrieve(methodId) : null
  if (method && id(method.customer) !== workspace.stripeCustomerId) throw new Error('Payment method access denied.')
  const periodEnd = Math.min(...subscription.items.data.map(item => item.current_period_end))
  return {
    status: subscription.status,
    cancellationScheduled: subscription.cancel_at_period_end,
    paymentOverdue: !['active', 'trialing'].includes(subscription.status) || !!workspace.billingStatus && !['active', 'trialing'].includes(workspace.billingStatus),
    trialEnd: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null,
    periodEnd: Number.isFinite(periodEnd) ? new Date(periodEnd * 1000).toISOString() : null,
    card: method?.card ? { brand: method.card.brand, last4: method.card.last4, month: method.card.exp_month, year: method.card.exp_year } : null,
  }
}

export async function createPaymentSetup(workspace: BillingWorkspace, stripe = stripeClient()) {
  await ownedSubscription(workspace, stripe)
  return stripe.setupIntents.create({
    customer: workspace.stripeCustomerId!, usage: 'off_session', payment_method_types: ['card'],
    metadata: { workspaceId: workspace.id, subscriptionId: workspace.stripeSubscriptionId! },
  })
}

export async function applyPaymentSetup(workspace: BillingWorkspace, setupId: string, stripe = stripeClient()) {
  const setup = await stripe.setupIntents.retrieve(setupId)
  if (setup.status !== 'succeeded' || id(setup.customer) !== workspace.stripeCustomerId ||
    setup.metadata?.workspaceId !== workspace.id || setup.metadata?.subscriptionId !== workspace.stripeSubscriptionId) throw new Error('Payment setup could not be verified.')
  const methodId = id(setup.payment_method)
  if (!methodId) throw new Error('No payment method found.')
  await ownedSubscription(workspace, stripe)
  const method = await stripe.paymentMethods.retrieve(methodId)
  if (id(method.customer) !== workspace.stripeCustomerId) throw new Error('Payment method access denied.')
  await stripe.subscriptions.update(workspace.stripeSubscriptionId!, { default_payment_method: methodId })
  await stripe.customers.update(workspace.stripeCustomerId!, { invoice_settings: { default_payment_method: methodId } })
}

export async function scheduleSubscriptionCancellation(workspace: BillingWorkspace, confirmed: boolean, stripe = stripeClient()) {
  if (confirmed !== true) throw new Error('Confirm cancellation first.')
  const subscription = await ownedSubscription(workspace, stripe)
  if (['canceled', 'incomplete_expired'].includes(subscription.status)) throw new Error('Subscription has already ended.')
  if (subscription.cancel_at_period_end) return subscription
  return stripe.subscriptions.update(subscription.id, { cancel_at_period_end: true })
}

export async function resumeSubscriptionRenewal(workspace: BillingWorkspace, confirmed: boolean, stripe = stripeClient()) {
  if (confirmed !== true) throw new Error('Confirm resuming your subscription first.')
  const subscription = await ownedSubscription(workspace, stripe)
  if (['canceled', 'incomplete_expired'].includes(subscription.status)) throw new Error('Your subscription has ended. Reactivate it through Plans & billing.')
  const periodEnd = Math.min(...subscription.items.data.map(item => item.current_period_end))
  if (!['active', 'trialing'].includes(subscription.status) || !Number.isFinite(periodEnd) || periodEnd * 1000 <= Date.now()) throw new Error('Your subscription needs payment confirmation. Open Plans & billing to restore access.')
  if (!subscription.cancel_at_period_end) return subscription
  // Keep the existing subscription, billing date, price, discounts and saved card.
  return stripe.subscriptions.update(subscription.id, { cancel_at_period_end: false })
}
