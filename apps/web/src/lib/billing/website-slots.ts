import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto'
import { z } from 'zod'
import type Stripe from 'stripe'
import { billingLifecycle, type BillingAccess } from '@awb/database/billing-policy'
import { stripeClient } from './stripe'
import { INDIVIDUAL_AMOUNT, INDIVIDUAL_CURRENCY } from './catalog'

type Workspace = BillingAccess & { id: string; stripeCustomerId: string | null; stripeSubscriptionId: string | null; billingWebsiteQuantity: number }
const quoteSchema = z.object({ workspaceId: z.string(), subscriptionId: z.string(), itemId: z.string(), quantity: z.number().int().min(2), prorationDate: z.number().int(), expiresAt: z.number().int(), amount: z.number().int(), currency: z.string(), endsTrial: z.boolean().default(false), requestId: z.string().uuid() })
type Quote = z.infer<typeof quoteSchema>
export class WebsitePurchaseError extends Error {}
function fail(message: string): never { throw new WebsitePurchaseError(message) }
const objectId = (value: string | { id: string } | null) => typeof value === 'string' ? value : value?.id

function signature(payload: string) {
  const secret = process.env.STRIPE_SECRET_KEY
  if (!secret) throw new Error('Stripe unavailable')
  return createHmac('sha256', secret).update(`website-slot:${payload}`).digest()
}
function encodeQuote(quote: Quote) {
  const payload = Buffer.from(JSON.stringify(quote)).toString('base64url')
  return `${payload}.${signature(payload).toString('base64url')}`
}
function decodeQuote(token: string, workspaceId: string) {
  const [payload, signed, extra] = token.split('.')
  if (!payload || !signed || extra || token.length > 3000) fail('Please review the website price again.')
  const supplied = Buffer.from(signed, 'base64url'), expected = signature(payload)
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) fail('Please review the website price again.')
  const parsed = quoteSchema.safeParse(JSON.parse(Buffer.from(payload, 'base64url').toString()))
  if (!parsed.success || parsed.data.workspaceId !== workspaceId) fail('Please review the website price again.')
  return parsed.data
}

async function ownedSubscription(workspace: Workspace, stripe: Stripe) {
  if (workspace.billingExempt) fail('Your workspace already has unlimited websites.')
  if (!workspace.stripeCustomerId || !workspace.stripeSubscriptionId) fail('Activate your subscription before adding another website.')
  const subscription = await stripe.subscriptions.retrieve(workspace.stripeSubscriptionId!, { expand: ['latest_invoice'] })
  if (objectId(subscription.customer) !== workspace.stripeCustomerId) throw new Error('Subscription customer mismatch')
  const item = subscription.items.data[0]
  if (subscription.items.data.length !== 1 || !item || !Number.isSafeInteger(item.quantity) || item.quantity! < 1 ||
      item.price.unit_amount !== INDIVIDUAL_AMOUNT || item.price.currency !== INDIVIDUAL_CURRENCY || item.price.billing_scheme !== 'per_unit' ||
      item.price.recurring?.interval !== 'month' || item.price.recurring.interval_count !== 1 || item.price.recurring.usage_type !== 'licensed' || item.price.transform_quantity) {
    fail('Your subscription needs review before adding a website. Contact support.')
  }
  return { subscription, item }
}

function requirePurchasable(workspace: Workspace, subscription: Stripe.Subscription, item: Stripe.SubscriptionItem) {
  const phase = billingLifecycle(workspace).phase
  const paid = phase === 'ACTIVE' && subscription.status === 'active'
  const trial = phase === 'TRIAL' && subscription.status === 'trialing' && item.quantity === 1 && !!subscription.trial_end && subscription.trial_end * 1000 > Date.now()
  if ((!paid && !trial) || subscription.collection_method !== 'charge_automatically' || item.current_period_end * 1000 <= Date.now()) fail('Resolve your subscription payment before adding another website.')
  if (subscription.cancel_at_period_end || subscription.cancel_at || subscription.schedule) fail('Resume renewal or contact support about your subscription schedule before adding another website.')
}

async function pendingResult(subscription: Stripe.Subscription, stripe: Stripe) {
  const invoiceId = objectId(subscription.latest_invoice)
  const invoice = invoiceId ? await stripe.invoices.retrieve(invoiceId) : null
  return { status: 'pending' as const, quantity: subscription.items.data[0]!.quantity!, endsTrial: subscription.status === 'trialing', invoiceUrl: invoice?.status === 'open' ? invoice.hosted_invoice_url : null }
}

async function previewInvoice(subscription: Stripe.Subscription, item: Stripe.SubscriptionItem, quantity: number, prorationDate: number, endsTrial: boolean, stripe: Stripe) {
  return stripe.invoices.createPreview({ subscription: subscription.id, preview_mode: 'next', subscription_details: {
    items: [{ id: item.id, quantity }], proration_behavior: 'always_invoice',
    ...(endsTrial ? { trial_end: 'now' as const } : { proration_date: prorationDate }),
  } })
}

export async function previewWebsiteSlot(workspace: Workspace, stripe = stripeClient()) {
  const { subscription, item } = await ownedSubscription(workspace, stripe)
  requirePurchasable(workspace, subscription, item)
  if (subscription.pending_update) return pendingResult(subscription, stripe)
  if (item.quantity !== workspace.billingWebsiteQuantity) fail('Your latest payment is being confirmed. Refresh billing before adding another website.')
  const outstanding = await stripe.invoices.list({ subscription: subscription.id, status: 'open', limit: 1 })
  if (outstanding.data.length) fail('Resolve your outstanding invoice before adding another website.')
  const prorationDate = Math.floor(Date.now() / 1000), quantity = item.quantity! + 1
  const endsTrial = subscription.status === 'trialing'
  const invoice = await previewInvoice(subscription, item, quantity, prorationDate, endsTrial, stripe)
  const quote = { workspaceId: workspace.id, subscriptionId: subscription.id, itemId: item.id, quantity, prorationDate, expiresAt: Math.min(prorationDate + 600, item.current_period_end), amount: invoice.amount_due, currency: invoice.currency, endsTrial, requestId: randomUUID() }
  const renewalEnd = endsTrial ? Math.max(0, ...invoice.lines.data.filter(line => line.pricing?.price_details?.price === item.price.id).map(line => line.period.end)) : item.current_period_end
  return { status: 'quote' as const, token: encodeQuote(quote), quantity, amountDue: invoice.amount_due, currency: invoice.currency, monthlyAmount: quantity * INDIVIDUAL_AMOUNT, endsTrial, renewalDate: renewalEnd ? new Date(renewalEnd * 1000).toISOString() : null }
}

// Call under the workspace row lock. The target quantity and idempotency key make
// duplicate clicks and retries safe even if Stripe succeeds before our DB commit.
export async function purchaseWebsiteSlot(workspace: Workspace, token: string, stripe = stripeClient()) {
  const quote = decodeQuote(token, workspace.id)
  const { subscription, item } = await ownedSubscription(workspace, stripe)
  if (quote.subscriptionId !== subscription.id || quote.itemId !== item.id) fail('Your subscription changed. Please review the website price again.')
  if (item.quantity! >= quote.quantity && !subscription.pending_update) return { status: 'paid' as const, quantity: item.quantity!, invoiceUrl: null }
  requirePurchasable(workspace, subscription, item)
  if (subscription.pending_update) return pendingResult(subscription, stripe)
  if (quote.endsTrial !== (subscription.status === 'trialing')) fail('Your trial status changed. Please review the website price again.')
  if (quote.expiresAt <= Math.floor(Date.now() / 1000) || quote.quantity !== item.quantity! + 1 || item.quantity !== workspace.billingWebsiteQuantity) fail('The website price expired or your subscription changed. Please review the price again.')
  const outstanding = await stripe.invoices.list({ subscription: subscription.id, status: 'open', limit: 1 })
  if (outstanding.data.length) fail('Resolve your outstanding invoice before adding another website.')
  const preview = await previewInvoice(subscription, item, quote.quantity, quote.prorationDate, quote.endsTrial, stripe)
  if (preview.amount_due !== quote.amount || preview.currency !== quote.currency) fail('The amount due changed. Please review the website price again.')
  const updated = await stripe.subscriptions.update(subscription.id, {
    items: [{ id: item.id, quantity: quote.quantity }],
    ...(quote.endsTrial ? { trial_end: 'now' as const } : { proration_date: quote.prorationDate }),
    proration_behavior: 'always_invoice', payment_behavior: 'pending_if_incomplete', expand: ['latest_invoice'],
  }, { idempotencyKey: `website-slot-${workspace.id}-${quote.requestId}` })
  if (updated.pending_update) return pendingResult(updated, stripe)
  return { status: 'paid' as const, quantity: updated.items.data[0]!.quantity!, invoiceUrl: null }
}

export async function cancelPendingWebsiteSlot(workspace: Workspace, stripe = stripeClient()) {
  const { subscription } = await ownedSubscription(workspace, stripe)
  if (!subscription.pending_update) return
  const invoiceId = objectId(subscription.latest_invoice)
  if (!invoiceId) throw new Error('Pending invoice missing')
  const invoice = await stripe.invoices.retrieve(invoiceId)
  if (invoice.status === 'open') await stripe.invoices.voidInvoice(invoice.id)
}
