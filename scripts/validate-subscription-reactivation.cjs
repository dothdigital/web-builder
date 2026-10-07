// Synthetic records and mocked Stripe/AWS only; never sends mail or charges a card.
require('dotenv').config({ path: '.env', quiet: true })
const assert = require('node:assert/strict')
const path = require('node:path')
const { randomUUID } = require('node:crypto')
const { prisma } = require('@awb/database')
const { syncSubscription, checkout } = require('../apps/web/src/lib/billing/service.ts')
const { billingLifecycle } = require('@awb/database/billing-policy')
const { queueBillingNotices } = require('../apps/web/src/lib/billing/notifications.ts')
const marker = `reactivation-test-${randomUUID()}`
const mock = (filename, exports) => { const resolved = require.resolve(filename); require.cache[resolved] = { id: resolved, filename: resolved, loaded: true, exports } }
const gates = []
mock(path.resolve(__dirname, '../apps/web/src/lib/hosting/aws.ts'), { setBillingGate: async value => { gates.push(value.suspended) } })
mock(path.resolve(__dirname, '../apps/web/src/lib/hosting/config.ts'), { assertHostingConfigured: () => ({}) })
const { syncBillingHosting } = require('../apps/web/src/lib/hosting/service.ts')
const { reconcileBillingLifecycle } = require('../apps/web/src/lib/billing/lifecycle.ts')
let userId, workspaceId
async function run() {
  try {
    const price = await prisma.billingPrice.findFirstOrThrow({ where: { planId: 'plan_solo', active: true, amount: 2900, currency: 'usd', interval: 'month' } })
    const user = await prisma.user.create({ data: { email: `${marker}@validation.invalid`, emailVerified: new Date(), memberships: { create: { role: 'OWNER', workspace: { create: { name: marker, slug: marker, stripeCustomerId: `cus_${marker}` } } } } }, include: { memberships: true } })
    userId = user.id; workspaceId = user.memberships[0].workspaceId
    const project = await prisma.project.create({ data: { workspaceId, name: marker, slug: marker, previewHost: `${marker}.validation.invalid`, hosting: { create: { distributionId: `fixture-${marker}` } } } })
    const end = Math.floor(Date.now() / 1000) + 30 * 86400
    let subscription = { id: `sub_old_${marker}`, customer: `cus_${marker}`, status: 'active', cancel_at_period_end: false, ended_at: null, cancellation_details: null, items: { data: [{ id: 'si_test', quantity: 1, current_period_end: end, price: { id: price.stripePriceId } }] }, latest_invoice: { id: `in_old_${marker}`, customer: `cus_${marker}`, created: Math.floor(Date.now() / 1000), status: 'paid', currency: 'usd', amount_paid: 0, number: 'FIXTURE-001', status_transitions: { paid_at: Math.floor(Date.now() / 1000) }, attempted: true, lines: { data: [{ parent: { type: 'subscription_item_details' }, pricing: { price_details: { price: price.stripePriceId } }, period: { end } }] } } }
    let previousSubscription
    const client = { subscriptions: { retrieve: async id => structuredClone(previousSubscription && id === previousSubscription.id && id !== subscription.id ? previousSubscription : subscription) }, invoices: { retrieve: async () => structuredClone(subscription.latest_invoice), list: async () => ({ data: [], has_more: false }) } }
    const counts = async kind => prisma.transactionalEmail.count({ where: { recipient: user.email, kind } })
    const current = () => prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId } })
    await syncSubscription(workspaceId, subscription.id, undefined, client)
    assert.equal(billingLifecycle(await current()).phase, 'ACTIVE')
    assert.equal(await counts('REACTIVATED'), 0, 'First payment is not described as reactivation')
    subscription.cancel_at_period_end = true
    const event = { id: `evt_${marker}`, type: 'customer.subscription.updated', created: Math.floor(Date.now() / 1000), data: { object: subscription } }
    await syncSubscription(workspaceId, subscription.id, event, client)
    await syncSubscription(workspaceId, subscription.id, event, client)
    await syncSubscription(workspaceId, subscription.id, undefined, client)
    assert.equal(await counts('CANCELLATION'), 1, 'Cancellation, webhook replay and sweep produce one email')
    assert.equal(billingLifecycle(await current()).editing, true)
    subscription.cancel_at_period_end = false
    await syncSubscription(workspaceId, subscription.id, undefined, client)
    await syncSubscription(workspaceId, subscription.id, undefined, client)
    assert.equal(await counts('RESUMED'), 1)
    assert.equal((await current()).cancelAtPeriodEnd, false)
    subscription.cancel_at_period_end = true
    await syncSubscription(workspaceId, subscription.id, undefined, client)
    assert.equal(await counts('CANCELLATION'), 2, 'A second deliberate cancellation in the same period gets a new confirmation')
    subscription.status = 'canceled'; subscription.cancel_at_period_end = false
    subscription.ended_at = Math.floor(Date.now() / 1000) - 86400
    await syncSubscription(workspaceId, subscription.id, undefined, client)
    assert.equal(await counts('RESUMED'), 1, 'Ending a cancelled subscription is not resuming it')
    await syncBillingHosting(project.id)
    assert.deepEqual(gates, [true])
    await syncBillingHosting(project.id)
    assert.deepEqual(gates, [true], 'Repeated suspension reconciliation does not recreate its gate')
    const suspended = (await current()).billingSubscriptionEndedAt
    const day = 86400 * 1000
    await prisma.workspace.update({ where: { id: workspaceId }, data: { billingSuspendedAt: suspended, billingRetentionEndsAt: new Date(suspended.getTime() + 90 * day), checkoutSessionId: `cs_old_${marker}`, checkoutExpiresAt: new Date(Date.now() + 1800000) } })
    for (const days of [60, 83, 89]) await prisma.$transaction(async tx => queueBillingNotices(tx, await tx.workspace.findUniqueOrThrow({ where: { id: workspaceId } }), new Date(suspended.getTime() + days * day)))
    assert.equal(await prisma.billingNotice.count({ where: { workspaceId, kind: { startsWith: 'RETENTION_' } } }), 3, '30-day, 7-day and 1-day retention warnings are queued')
    const reviewAt = new Date(suspended.getTime() + 91 * day)
    await reconcileBillingLifecycle(workspaceId, reviewAt)
    assert.equal((await current()).billingDeletionEligibleAt, null, 'Pending notices are not proof of delivered warnings')
    for (const [kind, days] of [['RETENTION_30', 60], ['RETENTION_7', 83]]) await prisma.billingNotice.updateMany({ where: { workspaceId, kind }, data: { status: 'SENT', sentAt: new Date(suspended.getTime() + days * day) } })
    await reconcileBillingLifecycle(workspaceId, reviewAt)
    assert.ok((await current()).billingDeletionEligibleAt, 'Review requires multiple delivered warnings')
    await prisma.workspace.update({ where: { id: workspaceId }, data: { billingLegalHold: true } })
    await reconcileBillingLifecycle(workspaceId, reviewAt)
    assert.equal((await current()).billingDeletionEligibleAt, null)
    assert.ok(await prisma.project.findUnique({ where: { id: project.id } }), 'Retention review never automatically deletes the website')
    let creates = 0, session
    const checkoutClient = {
      customers: { create: async () => { throw new Error('Reactivation must keep the customer') } },
      subscriptions: { list: async () => ({ data: [structuredClone(subscription)], has_more: false }) },
      checkout: { sessions: {
        retrieve: async id => id === `cs_old_${marker}` ? { status: 'complete', subscription: subscription.id } : session,
        create: async options => { creates++; assert.equal(options.customer, `cus_${marker}`); assert.equal(options.mode, 'subscription'); assert.equal(options.allow_promotion_codes, true); session = { id: `cs_new_${marker}`, url: 'https://checkout.stripe.com/fixture', expires_at: Math.floor(Date.now() / 1000) + 1800, status: 'open', metadata: options.metadata, allow_promotion_codes: true }; return session },
      } },
    }
    assert.equal(await checkout(workspaceId, price.id, user.email, checkoutClient), session.url)
    assert.equal(await checkout(workspaceId, price.id, user.email, checkoutClient), session.url)
    assert.equal(creates, 1, 'Concurrent/repeated checkout must reuse the open session')
    const previous = structuredClone(subscription)
    previousSubscription = previous
    await prisma.workspace.update({ where: { id: workspaceId }, data: { billingStatus: 'past_due' } })
    subscription = { ...subscription, id: `sub_new_${marker}`, status: 'active', ended_at: null, latest_invoice: { ...subscription.latest_invoice, id: `in_new_${marker}` } }
    await syncSubscription(workspaceId, subscription.id, undefined, client)
    await syncSubscription(workspaceId, subscription.id, undefined, client)
    const restored = await current()
    assert.equal(restored.stripeSubscriptionId, subscription.id)
    assert.equal(billingLifecycle(restored).phase, 'ACTIVE')
    assert.equal(restored.billingSuspendedAt, null)
    assert.equal(restored.billingRetentionEndsAt, null)
    assert.equal(restored.billingLegalHold, true)
    assert.equal(await counts('REACTIVATED'), 1)
    assert.equal(await counts('PAYMENT_RECEIPT'), 2, 'Each zero-dollar subscription invoice receives its own confirmation')
    assert.equal(await prisma.billingNotice.count({ where: { workspaceId, status: 'PENDING' } }), 0, 'Reactivation suppresses outdated suspension and retention warnings')
    await syncBillingHosting(project.id)
    assert.deepEqual(gates, [true, false], 'Previously published hosting is restored')
    assert.ok(await prisma.project.findUnique({ where: { id: project.id } }), 'The retained website is the same project')
    const activeId = subscription.id
    subscription = previous
    await syncSubscription(workspaceId, previous.id, undefined, client)
    assert.equal((await current()).stripeSubscriptionId, activeId, 'Old subscription cancellation cannot revoke reactivated access')
    const activeClient = { ...checkoutClient, subscriptions: { list: async () => ({ data: [{ ...previous, status: 'active' }], has_more: false }) }, billingPortal: { sessions: { create: async () => ({ url: 'https://billing.stripe.com/fixture' }) } } }
    assert.equal(await checkout(workspaceId, price.id, user.email, activeClient), 'https://billing.stripe.com/fixture')
    assert.equal(creates, 1, 'An existing subscription is resolved instead of creating duplicate billing')
    console.log('PASS: cancellation/resume emails, replay protection, repeat cancellation, same-customer reactivation checkout, zero-dollar invoice, retained project/legal hold, hosting suspension/restoration, and old-subscription isolation. No Stripe/AWS calls or emails.')
  } finally {
    await prisma.transactionalEmail.deleteMany({ where: { recipient: `${marker}@validation.invalid` } })
    await prisma.billingEvent.deleteMany({ where: { id: `evt_${marker}` } })
    if (workspaceId) { await prisma.auditEvent.deleteMany({ where: { workspaceId } }); await prisma.workspace.delete({ where: { id: workspaceId } }) }
    if (userId) await prisma.user.delete({ where: { id: userId } })
    await prisma.$disconnect()
  }
}
run().catch(error => { console.error(error); process.exitCode = 1 })
