// Read-only checks of the existing Stripe price and webhook configuration.
import 'dotenv/config'
import assert from 'node:assert/strict'
import { prisma } from '@awb/database'
import { stripeClient } from '../apps/web/src/lib/billing/stripe'
import { individualPriceFilter, INDIVIDUAL_PLAN_SLUG } from '../apps/web/src/lib/billing/catalog'

try {
  const mapped = await prisma.billingPrice.findFirstOrThrow({ where: { ...individualPriceFilter, plan: { slug: INDIVIDUAL_PLAN_SLUG, active: true } } })
  const stripe = stripeClient(), price = await stripe.prices.retrieve(mapped.stripePriceId)
  assert.equal(price.active, true)
  assert.equal(price.unit_amount, 2900)
  assert.equal(price.currency, 'usd')
  assert.equal(price.billing_scheme, 'per_unit')
  assert.equal(price.recurring?.interval, 'month')
  assert.equal(price.recurring?.interval_count, 1)
  assert.equal(price.recurring?.usage_type, 'licensed')
  assert.equal(price.transform_quantity, null)
  const endpoints = await stripe.webhookEndpoints.list({ limit: 100 })
  const endpoint = endpoints.data.find(item => item.status === 'enabled' && new URL(item.url).hostname === 'webtummy.com' && new URL(item.url).pathname === '/api/stripe/webhook')
  assert.ok(endpoint, 'Webtummy billing webhook must be enabled')
  for (const event of ['customer.subscription.updated', 'invoice.paid', 'invoice.payment_failed']) assert.ok(endpoint.enabled_events.includes('*') || endpoint.enabled_events.includes(event as never), `Webhook missing ${event}`)
  console.log(JSON.stringify({ ready: true, liveMode: price.livemode, existingPriceSupportsWebsiteQuantity: true, webhookHandlesQuantityAndPayments: true }))
} finally { await prisma.$disconnect() }
