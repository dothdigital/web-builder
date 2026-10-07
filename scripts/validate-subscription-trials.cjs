// Synthetic database records; Stripe, hosting and email delivery are mocked.
require('dotenv').config({ path: '.env', quiet: true })
const assert = require('node:assert/strict')
const path = require('node:path')
const { randomUUID } = require('node:crypto')
const { prisma } = require('@awb/database')
const { checkout, syncSubscription } = require('../apps/web/src/lib/billing/service.ts')
const { scheduleSubscriptionCancellation, resumeSubscriptionRenewal } = require('../apps/web/src/lib/billing/management.ts')
const { billingLifecycle, BILLING_DAY } = require('@awb/database/billing-policy')
const { deliverTransactionalEmails } = require('../apps/web/src/lib/transactional-email.ts')
const marker = `trial-test-${randomUUID()}`
const mock = (filename, exports) => { const resolved = require.resolve(filename); require.cache[resolved] = { id: resolved, filename: resolved, loaded: true, exports } }
const gates = []
mock(path.resolve(__dirname, '../apps/web/src/lib/hosting/aws.ts'), { setBillingGate: async value => { gates.push(value.suspended) } })
mock(path.resolve(__dirname, '../apps/web/src/lib/hosting/config.ts'), { assertHostingConfigured: () => ({}) })
const { syncBillingHosting } = require('../apps/web/src/lib/hosting/service.ts')
let userId
const workspaces = [], events = []
async function run() {
  try {
    const price = await prisma.billingPrice.findFirstOrThrow({ where: { planId: 'plan_solo', active: true, amount: 2900, currency: 'usd', interval: 'month' } })
    const user = await prisma.user.create({ data: { email: `${marker}@validation.invalid`, emailVerified: new Date(), memberships: { create: { role: 'OWNER', workspace: { create: { name: marker, slug: marker, stripeCustomerId: `cus_${marker}` } } } } }, include: { memberships: true } })
    userId = user.id; const workspaceId = user.memberships[0].workspaceId; workspaces.push(workspaceId)
    const other = await prisma.workspace.create({ data: { name: `${marker}-other`, slug: `${marker}-other`, stripeCustomerId: `cus_other_${marker}`, members: { create: { userId, role: 'OWNER' } } } }); workspaces.push(other.id)
    const project = await prisma.project.create({ data: { workspaceId, name: marker, slug: marker, previewHost: `${marker}.validation.invalid`, hosting: { create: { distributionId: `fixture-${marker}` } } } })
    const current = () => prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId } })
    const count = kind => prisma.transactionalEmail.count({ where: { recipient: user.email, kind } })
    const sessions = new Map(), options = []
    let subscription
    const client = {
      customers: { create: async () => { throw new Error('Existing customer must be reused') } },
      subscriptions: {
        list: async () => ({ data: subscription ? [structuredClone(subscription)] : [], has_more: false }),
        retrieve: async () => structuredClone(subscription),
        update: async (id, data) => { assert.equal(id, subscription.id); assert.deepEqual(Object.keys(data), ['cancel_at_period_end']); Object.assign(subscription, data); return structuredClone(subscription) },
      },
      checkout: { sessions: {
        retrieve: async id => sessions.get(id),
        expire: async id => { sessions.get(id).status = 'expired' },
        create: async data => { options.push(data); const session = { id: `cs_${marker}_${options.length}`, url: `https://checkout.stripe.com/fixture-${options.length}`, status: 'open', allow_promotion_codes: true, metadata: data.metadata, expires_at: Math.floor(Date.now() / 1000) + 1800 }; sessions.set(session.id, session); return session },
      } },
      invoices: { retrieve: async () => structuredClone(subscription.latest_invoice), list: async () => ({ data: subscription.latest_invoice.status === 'open' ? [structuredClone(subscription.latest_invoice)] : [], has_more: false }) },
    }
    assert.equal(billingLifecycle(await current()).editing, false, 'Registration alone does not grant a trial')
    const urls = await Promise.all([checkout(workspaceId, price.id, user.email, client), checkout(workspaceId, price.id, user.email, client)])
    assert.equal(urls[0], urls[1]); assert.equal(options.length, 1)
    assert.equal(options[0].subscription_data.trial_period_days, 7)
    assert.equal(options[0].payment_method_collection, 'always')
    assert.equal(options[0].line_items[0].price, price.stripePriceId)
    await assert.rejects(checkout(other.id, price.id, user.email, client), /already open/, 'A second workspace cannot open a simultaneous trial')
    const now = Math.floor(Date.now() / 1000), end = now + 7 * 86400
    subscription = { id: `sub_${marker}`, customer: `cus_${marker}`, status: 'trialing', trial_start: now, trial_end: end, cancel_at_period_end: false, ended_at: null, cancellation_details: null, items: { data: [{ id: 'si_test', quantity: 1, current_period_end: end, price: { id: price.stripePriceId } }] }, latest_invoice: { id: `in_trial_${marker}`, customer: `cus_${marker}`, created: now, status: 'paid', amount_paid: 0, currency: 'usd', number: 'FIXTURE-TRIAL', attempted: false, status_transitions: { paid_at: now }, lines: { data: [{ parent: { type: 'subscription_item_details' }, pricing: { price_details: { price: price.stripePriceId } }, period: { end } }] } } }
    const session = sessions.get((await current()).checkoutSessionId); session.status = 'complete'; session.subscription = subscription.id
    const event = { id: `evt_${marker}`, type: 'invoice.paid', created: now, data: { object: subscription.latest_invoice } }; events.push(event.id)
    await syncSubscription(workspaceId, subscription.id, event, client)
    await syncSubscription(workspaceId, subscription.id, event, client)
    await syncSubscription(workspaceId, subscription.id, undefined, client)
    const trial = await current()
    assert.equal(billingLifecycle(trial).phase, 'TRIAL')
    assert.equal(billingLifecycle(trial).hosting, true)
    assert.equal(trial.billingPaidThrough, null, 'The zero-dollar trial invoice is not a paid period')
    assert.ok(trial.billingTrialUsedAt)
    assert.ok((await prisma.user.findUniqueOrThrow({ where: { id: userId } })).billingTrialUsedAt)
    assert.equal(await count('WELCOME'), 1, 'Welcome is deduplicated before activation, including verified social signup')
    assert.equal(await count('TRIAL_STARTED'), 1)
    assert.equal(await count('PAYMENT_RECEIPT'), 0)
    const activation = await prisma.transactionalEmail.findFirstOrThrow({ where: { recipient: user.email, kind: 'TRIAL_STARTED' } })
    assert.match(activation.body, /full access/); assert.match(activation.body, /US\$29\/month/)
    assert.match(activation.body, /will not be charged the first/)
    for (const color of ['#6B4EE6', '#E8483A', '#0E8F82']) assert.ok(activation.html.includes(color))
    let delivered = 0
    await deliverTransactionalEmails({ id: activation.id, send: async () => { delivered++ } })
    await deliverTransactionalEmails({ id: activation.id, send: async () => { delivered++ } })
    assert.equal(delivered, 1)
    await syncBillingHosting(project.id); assert.deepEqual(gates, [])
    await scheduleSubscriptionCancellation(trial, true, client)
    await syncSubscription(workspaceId, subscription.id, undefined, client)
    assert.equal(billingLifecycle(await current()).phase, 'TRIAL')
    assert.match((await prisma.transactionalEmail.findFirstOrThrow({ where: { recipient: user.email, kind: 'CANCELLATION' } })).body, /will not be charged/)
    await resumeSubscriptionRenewal(await current(), true, client)
    assert.equal(subscription.trial_end, end, 'Resume never resets the seven-day clock')
    await syncSubscription(workspaceId, subscription.id, undefined, client)
    assert.equal(await count('RESUMED'), 1)
    assert.equal(billingLifecycle(trial, new Date(end * 1000 - 1)).phase, 'TRIAL')
    assert.equal(billingLifecycle(trial, new Date(end * 1000)).hosting, false, 'Stale trialing status cannot extend access')
    subscription.trial_end = now - 10
    subscription.items.data[0].current_period_end = now + 30 * 86400
    subscription.status = 'past_due'
    subscription.latest_invoice = { ...subscription.latest_invoice, id: `in_paid_${marker}`, created: now, status: 'open', attempted: true, amount_paid: 0, lines: { data: [{ parent: { type: 'subscription_item_details' }, pricing: { price_details: { price: price.stripePriceId } }, period: { end: now + 30 * 86400 } }] } }
    await syncSubscription(workspaceId, subscription.id, undefined, client)
    const failure = await current()
    assert.equal(failure.billingPaidThrough, null)
    assert.equal(billingLifecycle(failure).phase, 'SUSPENDED', 'The first failed charge grants no paid-renewal grace')
    assert.equal(billingLifecycle(failure).retentionEndsAt.getTime(), (now - 10) * 1000 + 90 * BILLING_DAY)
    await syncBillingHosting(project.id); assert.deepEqual(gates, [true])
    await prisma.transactionalEmail.update({ where: { id: activation.id }, data: { status: 'PENDING' } })
    await deliverTransactionalEmails({ id: activation.id, send: async () => { throw new Error('Expired trial email must not be sent') } })
    assert.equal((await prisma.transactionalEmail.findUniqueOrThrow({ where: { id: activation.id } })).status, 'SKIPPED')
    subscription.status = 'active'; subscription.latest_invoice.status = 'paid'; subscription.latest_invoice.amount_paid = 2900
    await syncSubscription(workspaceId, subscription.id, undefined, client)
    await syncSubscription(workspaceId, subscription.id, undefined, client)
    const paid = await current()
    assert.equal(billingLifecycle(paid).phase, 'ACTIVE')
    assert.equal(await count('PAYMENT_RECEIPT'), 1)
    assert.equal(await count('REACTIVATED'), 0, 'First trial payment sends one combined active/receipt email')
    assert.match((await prisma.transactionalEmail.findFirstOrThrow({ where: { recipient: user.email, kind: 'PAYMENT_RECEIPT' } })).body, /subscription is active/)
    await syncBillingHosting(project.id); assert.deepEqual(gates, [true, false])
    subscription.status = 'past_due'; subscription.latest_invoice.status = 'open'
    await syncSubscription(workspaceId, subscription.id, undefined, client)
    assert.equal(billingLifecycle(await current()).phase, 'GRACE', 'A later failed renewal gets the existing paid-customer grace')
    subscription.status = 'canceled'; subscription.ended_at = now; subscription.cancel_at_period_end = false
    await syncSubscription(workspaceId, subscription.id, undefined, client)
    await checkout(workspaceId, price.id, user.email, client)
    assert.equal(options.at(-1).subscription_data.trial_period_days, undefined, 'Reactivation never grants a repeat trial')
    await checkout(other.id, price.id, user.email, client)
    assert.equal(options.at(-1).subscription_data.trial_period_days, undefined, 'A used trial cannot be reset by another workspace')
    assert.ok(await prisma.project.findUnique({ where: { id: project.id } }))
    console.log('PASS: card-required 7-day checkout, concurrent session reuse, cross-workspace reservation, confirmed full trial access, themed activation email, trial invoice exclusion, cancellation/resume without extension, exact trial expiry, first-charge failure, one paid/active email, hosting recovery, paid-renewal grace and no repeat trials. No Stripe/AWS requests or emails.')
  } finally {
    await prisma.transactionalEmail.deleteMany({ where: { recipient: `${marker}@validation.invalid` } })
    await prisma.billingEvent.deleteMany({ where: { id: { in: events } } })
    await prisma.auditEvent.deleteMany({ where: { workspaceId: { in: workspaces } } })
    await prisma.workspace.deleteMany({ where: { id: { in: workspaces } } })
    if (userId) await prisma.user.delete({ where: { id: userId } })
    await prisma.$disconnect()
  }
}
run().catch(error => { console.error(error); process.exitCode = 1 })
