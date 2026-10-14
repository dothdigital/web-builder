// Temporary DB fixtures and mocked Stripe. Email functions are disabled.
require('dotenv').config({ path: '.env', quiet: true })
const assert = require('node:assert/strict')
const path = require('node:path')
const { randomUUID } = require('node:crypto')
const mock = (filename, exports) => { const resolved = require.resolve(filename); require.cache[resolved] = { id: resolved, filename: resolved, loaded: true, exports } }
mock(path.resolve(__dirname, '../apps/web/src/lib/billing/notifications.ts'), { queueBillingNotices: async () => {} })
mock(path.resolve(__dirname, '../apps/web/src/lib/transactional-email.ts'), { queuePaymentEmail: async () => {}, queueSubscriptionEmail: async () => {}, queueTrialEmail: async () => {} })
const { prisma } = require('@awb/database')
const { syncSubscription } = require('../apps/web/src/lib/billing/service.ts')
const { assertWebsiteCapacity, billingLifecycle } = require('../apps/web/src/lib/billing/access.ts')
const marker = `website-slots-db-${randomUUID()}`
let workspaceId, eventId
async function run() {
  try {
    const price = await prisma.billingPrice.findFirstOrThrow({ where: { active: true, amount: 2900, currency: 'usd', interval: 'month', plan: { slug: 'individual' } } })
    const end = Math.floor(Date.now() / 1000) + 30 * 86400
    const workspace = await prisma.workspace.create({ data: { name: marker, slug: marker, stripeCustomerId: `cus_${marker}`, stripeSubscriptionId: `sub_${marker}`, billingPlanId: price.planId, billingStatus: 'active', billingPaidThrough: new Date(end * 1000), billingPeriodEnd: new Date(end * 1000) } })
    workspaceId = workspace.id
    assert.equal(workspace.billingWebsiteQuantity, 1)
    const invoice = { id: `in_${marker}`, created: Math.floor(Date.now() / 1000), status: 'paid', attempted: true, lines: { data: [{ parent: { type: 'subscription_item_details' }, pricing: { price_details: { price: price.stripePriceId } }, period: { end } }] } }
    const subscription = { id: workspace.stripeSubscriptionId, customer: workspace.stripeCustomerId, status: 'active', cancel_at_period_end: false, ended_at: null, cancellation_details: null, pending_update: null, items: { data: [{ id: 'si_fixture', quantity: 2, current_period_end: end, price: { id: price.stripePriceId } }] }, latest_invoice: invoice }
    const stripe = { subscriptions: { retrieve: async () => structuredClone(subscription) }, invoices: { retrieve: async () => structuredClone(invoice), list: async () => ({ data: invoice.status === 'open' ? [structuredClone(invoice)] : [], has_more: false }) } }
    eventId = `evt_${marker}`
    const event = { id: eventId, type: 'invoice.paid', created: invoice.created, data: { object: { id: invoice.id } } }
    await Promise.all([syncSubscription(workspaceId, subscription.id, event, stripe), syncSubscription(workspaceId, subscription.id, event, stripe)])
    assert.equal((await prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId } })).billingWebsiteQuantity, 2)
    assert.equal(await prisma.billingEvent.count({ where: { id: eventId } }), 1)
    const create = async index => prisma.$transaction(async tx => {
      await assertWebsiteCapacity(tx, workspaceId)
      return tx.project.create({ data: { workspaceId, name: 'Capacity fixture', slug: `${marker}-${index}`, previewHost: `${marker}-${index}.validation.invalid` } })
    })
    await create(0)
    const attempts = await Promise.allSettled(Array.from({ length: 6 }, (_, index) => create(index + 1)))
    assert.equal(attempts.filter(result => result.status === 'fulfilled').length, 1)
    assert.equal(await prisma.project.count({ where: { workspaceId } }), 2)
    assert.ok(attempts.filter(result => result.status === 'rejected').every(result => /slots are in use/.test(result.reason.message)))
    subscription.pending_update = { expires_at: end }; invoice.status = 'open'
    await syncSubscription(workspaceId, subscription.id, undefined, stripe)
    const pending = await prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId } })
    assert.equal(pending.billingWebsiteQuantity, 2); assert.equal(billingLifecycle(pending).phase, 'ACTIVE')
    subscription.pending_update = null; subscription.items.data[0].quantity = 3; invoice.status = 'paid'
    await syncSubscription(workspaceId, subscription.id, undefined, stripe)
    await create(9)
    assert.equal(await prisma.project.count({ where: { workspaceId } }), 3)
    console.log('PASS: real DB quantity persistence, duplicate webhook delivery, concurrent creation limits and paid/pending capacity. No Stripe writes or email delivery.')
  } finally {
    if (workspaceId) await prisma.workspace.delete({ where: { id: workspaceId } })
    if (eventId) await prisma.billingEvent.deleteMany({ where: { id: eventId } })
    await prisma.$disconnect()
  }
}
run().catch(error => { console.error(error); process.exitCode = 1 })
