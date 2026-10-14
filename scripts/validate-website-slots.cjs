// Mocked Stripe and database only: this never charges a card or changes live data.
// TSX_TSCONFIG_PATH=apps/web/tsconfig.json node --import tsx scripts/validate-website-slots.cjs
const assert = require('node:assert/strict')
const path = require('node:path')
const mock = (filename, exports) => { const resolved = require.resolve(filename); require.cache[resolved] = { id: resolved, filename: resolved, loaded: true, exports } }
process.env.STRIPE_SECRET_KEY = 'sk_test_mock_website_slots'
const now = Math.floor(Date.now() / 1000), end = now + 30 * 86400
const baseWorkspace = { id: 'workspace-a', status: 'ACTIVE', billingExempt: false, billingPlanId: 'plan_solo', billingStatus: 'active', stripeCustomerId: 'cus_a', stripeSubscriptionId: 'sub_a', billingWebsiteQuantity: 1, billingPeriodEnd: new Date(end * 1000), billingPaidThrough: new Date(end * 1000), billingTrialEnd: null, billingTrialUsedAt: null, billingDelinquentSince: null, cancelAtPeriodEnd: false }
const baseInvoice = { id: 'in_a', status: 'paid', created: now, attempted: true, amount_paid: 2900, currency: 'usd', lines: { data: [{ parent: { type: 'subscription_item_details' }, pricing: { price_details: { price: 'price_a' } }, period: { end } }] } }
const baseSubscription = { id: 'sub_a', customer: 'cus_a', status: 'active', collection_method: 'charge_automatically', cancel_at_period_end: false, cancel_at: null, schedule: null, pending_update: null, ended_at: null, cancellation_details: null, items: { data: [{ id: 'si_a', quantity: 1, current_period_end: end, price: { id: 'price_a', unit_amount: 2900, currency: 'usd', billing_scheme: 'per_unit', recurring: { interval: 'month', interval_count: 1, usage_type: 'licensed' }, transform_quantity: null } }] }, latest_invoice: baseInvoice }
let subscription, workspace, outstanding, updates, previews, amount, decline, failAfterStripe, projects, allowOwner = true
function reset() { subscription = structuredClone(baseSubscription); workspace = structuredClone(baseWorkspace); outstanding = []; updates = []; previews = []; amount = 1450; decline = false; failAfterStripe = false; projects = 0 }
function trial() {
  reset(); amount = 5800
  const trialEnd = now + 7 * 86400
  Object.assign(workspace, { billingStatus: 'trialing', billingPaidThrough: null, billingTrialEnd: new Date(trialEnd * 1000), billingPeriodEnd: new Date(trialEnd * 1000) })
  Object.assign(subscription, { status: 'trialing', trial_start: now, trial_end: trialEnd })
  subscription.items.data[0].current_period_end = trialEnd
}
const stripe = {
  subscriptions: {
    retrieve: async () => structuredClone(subscription),
    update: async (id, data, options) => {
      assert.equal(id, 'sub_a'); updates.push({ data, options })
      if (decline) {
        subscription.pending_update = { expires_at: now + 3600, subscription_items: [{ id: 'si_a', quantity: data.items[0].quantity }], ...(data.trial_end ? { trial_end: now } : {}) }
        subscription.latest_invoice = { ...baseInvoice, id: 'in_upgrade', status: 'open', amount_paid: 0, hosted_invoice_url: 'https://invoice.stripe.com/test' }
        outstanding = [subscription.latest_invoice]
      } else {
        subscription.items.data[0].quantity = data.items[0].quantity; subscription.latest_invoice = { ...baseInvoice, id: 'in_upgrade' }
        if (data.trial_end === 'now') { subscription.status = 'active'; subscription.trial_end = now; subscription.items.data[0].current_period_end = end }
      }
      if (failAfterStripe) { failAfterStripe = false; throw new Error('Network timeout after Stripe applied update') }
      return structuredClone(subscription)
    },
  },
  invoices: {
    createPreview: async data => { previews.push(data); return { amount_due: amount, currency: 'usd', lines: structuredClone(baseInvoice.lines) } },
    retrieve: async () => structuredClone(subscription.latest_invoice),
    list: async () => ({ data: structuredClone(outstanding), has_more: false }),
    voidInvoice: async id => { assert.equal(id, 'in_upgrade'); subscription.pending_update = null; subscription.latest_invoice.status = 'void'; outstanding = [] },
  },
}
const tx = {
  $queryRaw: async () => [],
  workspace: { findUniqueOrThrow: async () => structuredClone({ ...workspace, _count: { projects } }), update: async ({ data }) => { workspace = { ...workspace, ...data }; return workspace } },
  billingPrice: { findUnique: async () => ({ planId: 'plan_solo', amount: 2900, currency: 'usd', interval: 'month' }) },
  billingEvent: { findUnique: async () => null, create: async () => ({}) },
  billingNotice: { updateMany: async () => ({}) },
  emailContact: { updateMany: async () => ({}) },
  user: { updateMany: async () => ({}) },
  auditEvent: { create: async () => ({ id: 'audit_a' }) },
}
mock('@awb/database', { prisma: { ...tx, $transaction: async callback => callback(tx) }, WorkspaceRole: { OWNER: 'OWNER' } })
mock(path.resolve(__dirname, '../apps/web/src/lib/billing/stripe.ts'), { stripeClient: () => stripe })
mock(path.resolve(__dirname, '../apps/web/src/lib/account-security.ts'), { appUrl: () => 'https://webtummy.com' })
mock(path.resolve(__dirname, '../apps/web/src/lib/billing/notifications.ts'), { queueBillingNotices: async () => {} })
mock(path.resolve(__dirname, '../apps/web/src/lib/transactional-email.ts'), { queuePaymentEmail: async () => {}, queueSubscriptionEmail: async () => {}, queueTrialEmail: async () => {} })
const { previewWebsiteSlot, purchaseWebsiteSlot, cancelPendingWebsiteSlot } = require('../apps/web/src/lib/billing/website-slots.ts')
const { syncSubscription, subscriptionState, checkout } = require('../apps/web/src/lib/billing/service.ts')
const { assertWebsiteCapacity, websiteCapacity } = require('../apps/web/src/lib/billing/access.ts')
const { billingLifecycle } = require('@awb/database/billing-policy')

async function trialUpgrade() {
  trial()
  const originalTrialEnd = subscription.trial_end
  const quote = await previewWebsiteSlot(workspace, stripe)
  assert.equal(quote.endsTrial, true); assert.equal(quote.amountDue, 5800); assert.equal(quote.monthlyAmount, 5800)
  assert.equal(previews[0].subscription_details.trial_end, 'now')
  assert.equal(subscription.trial_end, originalTrialEnd, 'Price review must preserve the trial')
  assert.equal(updates.length, 0)
  await purchaseWebsiteSlot(workspace, quote.token, stripe)
  assert.equal(updates[0].data.trial_end, 'now'); assert.equal(updates[0].data.items[0].quantity, 2)
  assert.equal(updates[0].data.payment_behavior, 'pending_if_incomplete')
  await syncSubscription(workspace.id, subscription.id, undefined, stripe)
  assert.equal(workspace.billingWebsiteQuantity, 2); assert.equal(billingLifecycle(workspace).phase, 'ACTIVE')
  assert.ok(workspace.billingPaidThrough)
  await purchaseWebsiteSlot(workspace, quote.token, stripe)
  assert.equal(updates.length, 1, 'A successful trial upgrade cannot be charged again')

  trial(); decline = true
  const failedQuote = await previewWebsiteSlot(workspace, stripe), trialEnd = subscription.trial_end
  const pending = await purchaseWebsiteSlot(workspace, failedQuote.token, stripe)
  assert.equal(pending.status, 'pending'); assert.equal(pending.endsTrial, true)
  await syncSubscription(workspace.id, subscription.id, undefined, stripe)
  assert.equal(subscription.trial_end, trialEnd)
  assert.equal(workspace.billingWebsiteQuantity, 1); assert.equal(billingLifecycle(workspace).phase, 'TRIAL')
  assert.equal(workspace.billingPaidThrough, null, 'Failed upgrades cannot grant paid access or new websites')
  await purchaseWebsiteSlot(workspace, failedQuote.token, stripe); assert.equal(updates.length, 1)
  await cancelPendingWebsiteSlot(workspace, stripe)
  assert.equal(subscription.trial_end, trialEnd)

  trial()
  const stale = await previewWebsiteSlot(workspace, stripe)
  subscription.status = 'active'; subscription.trial_end = now
  Object.assign(workspace, baseWorkspace)
  await assert.rejects(purchaseWebsiteSlot(workspace, stale.token, stripe), /trial status changed/)
  assert.equal(updates.length, 0, 'An expired trial quote must be reviewed as a paid upgrade')
  console.log('PASS: full-price trial upgrade, payment-gated trial ending, decline preservation, duplicate safety and stale-trial quotes')
}

async function services() {
  reset()
  const quote = await previewWebsiteSlot(workspace, stripe)
  assert.equal(quote.status, 'quote'); assert.equal(quote.amountDue, 1450); assert.equal(quote.quantity, 2); assert.equal(quote.monthlyAmount, 5800)
  assert.equal(updates.length, 0, 'Reviewing a quote must never charge a card')
  await assert.rejects(purchaseWebsiteSlot({ ...workspace, id: 'workspace-b' }, quote.token, stripe))
  await assert.rejects(purchaseWebsiteSlot(workspace, quote.token + 'x', stripe))
  amount++
  await assert.rejects(purchaseWebsiteSlot(workspace, quote.token, stripe), /amount due changed/)
  assert.equal(updates.length, 0)
  amount--
  const originalNow = Date.now
  Date.now = () => originalNow() + 601000
  try { await assert.rejects(purchaseWebsiteSlot(workspace, quote.token, stripe), /expired/) }
  finally { Date.now = originalNow }
  const otherQuote = await previewWebsiteSlot(workspace, stripe)
  assert.equal((await purchaseWebsiteSlot(workspace, quote.token, stripe)).status, 'paid')
  assert.equal(updates[0].data.payment_behavior, 'pending_if_incomplete')
  assert.equal(updates[0].data.proration_behavior, 'always_invoice')
  assert.equal(updates[0].data.proration_date, previews[0].subscription_details.proration_date)
  assert.ok(updates[0].options.idempotencyKey)
  await purchaseWebsiteSlot(workspace, quote.token, stripe)
  await purchaseWebsiteSlot(workspace, otherQuote.token, stripe)
  assert.equal(updates.length, 1, 'Replaying a completed purchase must not add or charge another slot')
  await syncSubscription(workspace.id, subscription.id, undefined, stripe)
  assert.equal(workspace.billingWebsiteQuantity, 2)
  projects = 1; await assertWebsiteCapacity(tx, workspace.id)
  projects = 2; await assert.rejects(assertWebsiteCapacity(tx, workspace.id), /slots are in use/)
  assert.equal(websiteCapacity(workspace), 2)
  assert.equal(subscriptionState(subscription, 'plan_solo').billingStatus, 'active')
  console.log('PASS: exact-price review, signed tenant-bound quotes, paid capacity, and duplicate/retry protection')

  reset(); decline = true
  const declinedQuote = await previewWebsiteSlot(workspace, stripe)
  const pending = await purchaseWebsiteSlot(workspace, declinedQuote.token, stripe)
  assert.equal(pending.status, 'pending'); assert.match(pending.invoiceUrl, /^https:\/\/invoice.stripe.com/)
  await syncSubscription(workspace.id, subscription.id, undefined, stripe)
  assert.equal(workspace.billingWebsiteQuantity, 1)
  assert.equal(workspace.billingStatus, 'active'); assert.equal(workspace.billingDelinquentSince, null)
  assert.equal(billingLifecycle(workspace).phase, 'ACTIVE', 'Failed optional purchases must preserve existing paid access')
  assert.equal((await previewWebsiteSlot(workspace, stripe)).status, 'pending')
  await purchaseWebsiteSlot(workspace, declinedQuote.token, stripe)
  assert.equal(updates.length, 1, 'A pending purchase reuses its invoice instead of charging again')
  outstanding.push({ ...baseInvoice, id: 'in_overdue_renewal', status: 'open' })
  await syncSubscription(workspace.id, subscription.id, undefined, stripe)
  assert.equal(workspace.billingStatus, 'past_due', 'Unpaid regular renewals still restrict access')
  outstanding.pop()
  await cancelPendingWebsiteSlot(workspace, stripe)
  await syncSubscription(workspace.id, subscription.id, undefined, stripe)
  assert.equal(workspace.billingWebsiteQuantity, 1)
  assert.equal(subscription.pending_update, null)
  console.log('PASS: declines and authentication leave new slots locked; unpaid purchases can be cancelled')

  reset(); decline = true
  const authQuote = await previewWebsiteSlot(workspace, stripe)
  await purchaseWebsiteSlot(workspace, authQuote.token, stripe)
  subscription.pending_update = null; subscription.items.data[0].quantity = 2; subscription.latest_invoice.status = 'paid'; outstanding = []
  await syncSubscription(workspace.id, subscription.id, undefined, stripe)
  assert.equal(workspace.billingWebsiteQuantity, 2, 'Completed hosted-invoice payment grants the slot')
  reset(); failAfterStripe = true
  const retryQuote = await previewWebsiteSlot(workspace, stripe)
  await assert.rejects(purchaseWebsiteSlot(workspace, retryQuote.token, stripe), /timeout/)
  await purchaseWebsiteSlot(workspace, retryQuote.token, stripe)
  assert.equal(updates.length, 1, 'A lost success response must not produce a second charge')
  console.log('PASS: eventual payment confirmation and recovery after a lost Stripe response')

  reset()
  for (const change of [{ billingExempt: true }, { billingStatus: 'past_due' }, { status: 'SUSPENDED' }, { stripeSubscriptionId: null }]) await assert.rejects(previewWebsiteSlot({ ...workspace, ...change }, stripe))
  for (const change of [{ customer: 'cus_b' }, { status: 'trialing' }, { cancel_at_period_end: true }, { schedule: 'sched_a' }, { collection_method: 'send_invoice' }]) {
    subscription = { ...structuredClone(baseSubscription), ...change }
    await assert.rejects(previewWebsiteSlot(workspace, stripe))
  }
  subscription = structuredClone(baseSubscription); subscription.items.data[0].price.unit_amount = 3000
  await assert.rejects(previewWebsiteSlot(workspace, stripe))
  assert.equal(updates.length, 0)
  reset(); subscription.items.data[0].quantity = 3; subscription.latest_invoice.status = 'open'; outstanding = [subscription.latest_invoice]
  await syncSubscription(workspace.id, subscription.id, undefined, stripe)
  assert.equal(workspace.billingWebsiteQuantity, 1, 'An unpaid external quantity update must not grant extra capacity')
  reset(); subscription.status = 'trialing'; subscription.trial_end = end; subscription.trial_start = now; subscription.items.data[0].quantity = 2
  workspace.billingPaidThrough = null
  await syncSubscription(workspace.id, subscription.id, undefined, stripe)
  assert.equal(workspace.billingWebsiteQuantity, 1, 'A free trial cannot grant additional unpaid websites')
  console.log('PASS: tenant isolation, trial/cancellation/overdue guards and unpaid external update protection')

  // Reactivation must cover all retained slots and projects, without another trial.
  reset(); workspace.billingWebsiteQuantity = 3; workspace.billingTrialUsedAt = new Date(); projects = 3
  let checkoutOptions
  tx.project = { count: async () => projects }
  tx.billingPrice.findUnique = async () => ({ id: 'bp_a', active: true, stripePriceId: 'price_a', amount: 2900, currency: 'usd', interval: 'month', plan: { id: 'plan_solo', active: true, slug: 'individual', websiteLimit: 1 } })
  tx.user.findUniqueOrThrow = async () => ({ id: 'user-a', billingTrialUsedAt: new Date() })
  tx.workspaceMember = { count: async () => 1 }
  stripe.subscriptions.list = async () => ({ data: [], has_more: false })
  stripe.checkout = { sessions: { create: async options => { checkoutOptions = options; return { id: 'cs_a', url: 'https://checkout.stripe.com/test', expires_at: end } } } }
  await checkout(workspace.id, 'bp_a', 'test@validation.invalid', stripe)
  assert.equal(checkoutOptions.line_items[0].quantity, 3)
  assert.equal(checkoutOptions.subscription_data.trial_period_days, undefined)
  assert.match(checkoutOptions.custom_text.submit.message, /US\$87 per month/)
  projects = 4; workspace.checkoutSessionId = null
  await checkout(workspace.id, 'bp_a', 'test@validation.invalid', stripe)
  assert.equal(checkoutOptions.line_items[0].quantity, 4)
  console.log('PASS: reactivation bills the correct quantity for all retained websites')
}

async function authorization() {
  reset()
  mock('next/cache', { revalidatePath() {} })
  mock(path.resolve(__dirname, '../apps/web/src/lib/tenancy.ts'), {
    requireUser: async () => ({ id: 'user-a' }), primaryWorkspace: async () => workspace,
    requireWorkspace: async (_id, role) => { assert.equal(role, 'OWNER'); if (!allowOwner) throw new Error('Forbidden') },
  })
  const { confirmWebsitePurchase, reviewWebsitePurchase } = require('../apps/web/src/app/actions/website-slots.ts')
  const quote = await previewWebsiteSlot(workspace, stripe)
  assert.equal((await confirmWebsitePurchase(quote.token, false)).ok, false)
  allowOwner = false
  assert.equal((await confirmWebsitePurchase(quote.token, true)).ok, false)
  assert.equal((await reviewWebsitePurchase()).ok, false)
  assert.equal(updates.length, 0)
  allowOwner = true
  console.log('PASS: server actions require owner authorization and explicit purchase confirmation')
}

async function dialog() {
  reset()
  const { JSDOM } = require('jsdom'), React = require('react'), { act } = React, { createRoot } = require('react-dom/client')
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost:3000/billing' })
  global.window = dom.window; global.self = dom.window; global.document = dom.window.document; global.HTMLElement = dom.window.HTMLElement; global.IS_REACT_ACT_ENVIRONMENT = true
  dom.window.HTMLDialogElement.prototype.showModal = function () { this.open = true }
  dom.window.HTMLDialogElement.prototype.close = function () { this.open = false }
  let charges = 0, refreshed = 0, uiTrial = false, nextPath = ''
  mock('next/navigation', { useRouter: () => ({ refresh() { refreshed++ }, push(path) { nextPath = path } }) })
  mock(path.resolve(__dirname, '../apps/web/src/app/actions/website-slots.ts'), {
    reviewWebsitePurchase: async () => ({ ok: true, purchase: { status: 'quote', token: 'signed_quote', quantity: 2, amountDue: uiTrial ? 5800 : 1450, currency: 'usd', monthlyAmount: 5800, endsTrial: uiTrial, renewalDate: new Date(end * 1000).toISOString() } }),
    confirmWebsitePurchase: async (token, consent) => { assert.equal(token, 'signed_quote'); assert.equal(consent, true); charges++; return { ok: true, purchase: uiTrial ? { status: 'paid', quantity: 2, invoiceUrl: null } : { status: 'pending', quantity: 1, endsTrial: false, invoiceUrl: 'https://invoice.stripe.com/test' } } },
    refreshWebsitePurchase: async () => ({ ok: true, quantity: 2, paid: true }), cancelWebsitePurchase: async () => ({ ok: true }),
  })
  require.extensions['.css'] = module => { module.exports = {} }
  const { WebsiteSlots } = require('../apps/web/src/components/account/website-slots.tsx')
  const root = createRoot(document.getElementById('root'))
  const button = text => [...document.querySelectorAll('button')].find(node => node.textContent === text)
  const click = async node => { assert.ok(node); await act(async () => node.click()) }
  await act(async () => root.render(React.createElement(WebsiteSlots, { quantity: 1, used: 1, owner: true, available: true, trialing: false })))
  await click(button('Add website · $29/month'))
  assert.equal(charges, 0); assert.equal(document.querySelector('dialog').open, true)
  assert.match(document.body.textContent, /Due today: \$14.50/); assert.match(document.body.textContent, /\$58.00 for 2 websites/)
  assert.equal(button('Confirm purchase · $14.50').disabled, true)
  await click(document.querySelector('input[type="checkbox"]'))
  await click(button('Confirm purchase · $14.50'))
  assert.equal(charges, 1)
  assert.ok(document.querySelector('a[href="https://invoice.stripe.com/test"]'))
  assert.match(document.body.textContent, /new slot stays locked/)
  await click([...document.querySelectorAll('dialog button')].find(node => node.textContent === 'Refresh payment status'))
  assert.ok(refreshed > 0); assert.match(document.body.textContent, /Payment confirmed/)
  await act(async () => root.render(React.createElement(WebsiteSlots, { quantity: 1, used: 1, owner: false, available: true, trialing: false })))
  assert.equal(button('Add website · $29/month'), undefined)
  uiTrial = true; nextPath = ''
  await act(async () => root.render(React.createElement(WebsiteSlots, { quantity: 1, used: 1, owner: true, available: true, trialing: true })))
  assert.equal(button('Upgrade / add new website').disabled, false)
  await click(button('Upgrade / add new website'))
  assert.match(document.body.textContent, /Your free trial will end/)
  assert.match(document.body.textContent, /charge your saved payment method immediately/)
  assert.match(document.body.textContent, /No new 7-day trial/)
  assert.match(document.body.textContent, /Due today: \$58.00/)
  assert.equal(button('Proceed to upgrade / add website · $58.00').disabled, true)
  assert.equal(charges, 1, 'Opening trial upgrade does not charge or end a trial')
  await click(button('Close')); assert.equal(charges, 1, 'Closing the popup does not charge or end a trial')
  await click(button('Upgrade / add new website'))
  await click(document.querySelector('input[type="checkbox"]'))
  await click(button('Proceed to upgrade / add website · $58.00'))
  assert.equal(charges, 2); assert.equal(nextPath, '/onboarding')
  assert.equal(document.querySelector('dialog').open, false)
  await act(async () => root.unmount()); dom.window.close()
  console.log('PASS: customer quote, consent, hosted payment recovery, refresh and role/trial UI')
}

trialUpgrade().then(services).then(authorization).then(dialog).catch(error => { console.error(error); process.exitCode = 1 })
