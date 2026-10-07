// Runs entirely against mocks: never changes a live Stripe subscription.
// TSX_TSCONFIG_PATH=apps/web/tsconfig.json node --import tsx scripts/validate-billing-management.cjs
const assert = require('node:assert/strict')
const path = require('node:path')
const { createPaymentSetup, applyPaymentSetup, scheduleSubscriptionCancellation, resumeSubscriptionRenewal } = require('../apps/web/src/lib/billing/management.ts')
const { confirmedCheckoutSubscription } = require('../apps/web/src/lib/billing/checkout-result.ts')

async function services() {
  const workspace = { id: 'workspace-a', stripeCustomerId: 'cus_a', stripeSubscriptionId: 'sub_a' }
  const session = { mode: 'subscription', status: 'complete', payment_status: 'paid', customer: 'cus_a', subscription: 'sub_a', client_reference_id: 'workspace-a', metadata: { workspaceId: 'workspace-a' } }
  assert.equal(confirmedCheckoutSubscription(session, workspace), 'sub_a')
  assert.equal(confirmedCheckoutSubscription({ ...session, payment_status: 'no_payment_required' }, workspace), 'sub_a')
  for (const change of [{ status: 'open' }, { payment_status: 'unpaid' }, { customer: 'cus_b' }, { client_reference_id: 'workspace-b' }, { metadata: { workspaceId: 'workspace-b' } }, { subscription: null }, { mode: 'payment' }]) {
    assert.equal(confirmedCheckoutSubscription({ ...session, ...change }, workspace), null)
  }
  console.log('PASS: checkout return requires a completed payment belonging to the workspace')
  let customer = 'cus_a', writes = [], status = 'active', scheduled = false, periodEnd = Math.floor(Date.now() / 1000) + 86400
  let setup = { status: 'succeeded', customer: 'cus_a', metadata: { workspaceId: 'workspace-a', subscriptionId: 'sub_a' }, payment_method: 'pm_a' }
  const stripe = {
    subscriptions: {
      retrieve: async () => ({ id: 'sub_a', customer, status, cancel_at_period_end: scheduled, items: { data: [{ current_period_end: periodEnd }] } }),
      update: async (id, data) => { writes.push({ kind: 'subscription', id, data }); if ('cancel_at_period_end' in data) scheduled = data.cancel_at_period_end; return { id, customer, cancel_at_period_end: data.cancel_at_period_end } },
    },
    setupIntents: { retrieve: async () => setup, create: async data => { writes.push({ kind: 'setup', data }); return { id: 'seti_a' } } },
    paymentMethods: { retrieve: async () => ({ customer: 'cus_a' }) },
    customers: { update: async (id, data) => { writes.push({ kind: 'customer', id, data }) } },
  }
  await assert.rejects(scheduleSubscriptionCancellation(workspace, false, stripe))
  assert.equal(writes.length, 0, 'Unconfirmed cancellation must not mutate Stripe')
  customer = 'cus_b'
  await assert.rejects(scheduleSubscriptionCancellation(workspace, true, stripe))
  await assert.rejects(createPaymentSetup(workspace, stripe))
  await assert.rejects(resumeSubscriptionRenewal(workspace, true, stripe))
  assert.equal(writes.length, 0, 'Another customer must not be modified')
  customer = 'cus_a'
  await scheduleSubscriptionCancellation(workspace, true, stripe)
  assert.deepEqual(writes.pop(), { kind: 'subscription', id: 'sub_a', data: { cancel_at_period_end: true } })
  await assert.rejects(resumeSubscriptionRenewal(workspace, false, stripe))
  await resumeSubscriptionRenewal(workspace, true, stripe)
  assert.deepEqual(writes.pop(), { kind: 'subscription', id: 'sub_a', data: { cancel_at_period_end: false } })
  await resumeSubscriptionRenewal(workspace, true, stripe)
  assert.equal(writes.length, 0, 'An already-resumed subscription is not mutated')
  status = 'canceled'
  await assert.rejects(resumeSubscriptionRenewal(workspace, true, stripe), /ended/)
  status = 'past_due'
  await assert.rejects(resumeSubscriptionRenewal(workspace, true, stripe), /payment confirmation/)
  status = 'active'; periodEnd = 1
  await assert.rejects(resumeSubscriptionRenewal(workspace, true, stripe), /payment confirmation/)
  assert.equal(writes.length, 0)
  periodEnd = Math.floor(Date.now() / 1000) + 86400
  const original = setup
  for (const change of [{ status: 'requires_action' }, { customer: 'cus_b' }, { metadata: null }, { metadata: { workspaceId: 'workspace-b', subscriptionId: 'sub_a' } }, { metadata: { workspaceId: 'workspace-a', subscriptionId: 'sub_b' } }, { payment_method: null }]) {
    setup = { ...original, ...change }
    await assert.rejects(applyPaymentSetup(workspace, 'seti_a', stripe))
    assert.equal(writes.length, 0)
  }
  setup = original
  await applyPaymentSetup(workspace, 'seti_a', stripe)
  assert.deepEqual(writes.map(write => write.kind), ['subscription', 'customer'])
  assert.equal(writes[0].data.default_payment_method, 'pm_a')
  assert.equal(writes[1].data.invoice_settings.default_payment_method, 'pm_a')
  console.log('PASS: subscription ownership, confirmed cancellation, and verified default-card updates')
}

async function dialog() {
  const { JSDOM } = require('jsdom')
  const dom = new JSDOM('<div id="root"></div><div id="billing-payment-history"></div>', { url: 'http://localhost:3000/billing' })
  global.window = dom.window; global.document = dom.window.document
  global.HTMLElement = dom.window.HTMLElement; global.IS_REACT_ACT_ENVIRONMENT = true
  dom.window.HTMLDialogElement.prototype.showModal = function () { this.open = true }
  dom.window.HTMLDialogElement.prototype.close = function () { this.open = false }
  dom.window.HTMLElement.prototype.scrollIntoView = function () {}
  const React = require('react'), { act } = React, { createRoot } = require('react-dom/client')
  let cancelled = 0, saved = 0, scheduled = false, resumed = 0, status = 'active'
  const summary = () => ({ status, cancellationScheduled: scheduled, periodEnd: '2026-11-05T00:00:00Z', card: { brand: 'visa', last4: '4242', month: 12, year: 2030 } })
  const mock = (filename, exports) => { const resolved = require.resolve(filename); require.cache[resolved] = { id: resolved, filename: resolved, loaded: true, exports } }
  mock('next/navigation', { useRouter: () => ({ refresh() {}, replace() {} }) })
  mock(path.resolve(__dirname, '../apps/web/src/app/actions/billing-management.ts'), {
    loadBillingManagement: async () => ({ ok: true, summary: summary() }),
    startPaymentUpdate: async () => ({ ok: true, clientSecret: 'test', publishableKey: 'pk_test_mock', returnUrl: 'http://localhost:3000/billing' }),
    finishPaymentUpdate: async id => { assert.equal(id, 'seti_mock'); saved++; return { ok: true, message: 'Payment details updated.' } },
    resumeSubscription: async confirmed => { assert.equal(confirmed, true); resumed++; scheduled = false; return { ok: true, message: 'Subscription resumed.' } },
    cancelSubscription: async confirmed => { assert.equal(confirmed, true); cancelled++; scheduled = true; return { ok: true, message: 'Renewal cancelled.' } },
  })
  mock('@stripe/stripe-js', { loadStripe: async () => ({}) })
  mock('@stripe/react-stripe-js', {
    Elements: ({ children }) => children,
    PaymentElement: ({ onReady }) => { React.useEffect(onReady, []); return React.createElement('div', null, 'Secure card form') },
    useElements: () => ({}),
    useStripe: () => ({ confirmSetup: async options => { assert.equal(options.redirect, 'if_required'); return { setupIntent: { id: 'seti_mock', status: 'succeeded' } } } }),
  })
  require.extensions['.css'] = module => { module.exports = {} }
  const { BillingManagement } = require('../apps/web/src/components/account/billing-management.tsx')
  const root = createRoot(document.getElementById('root'))
  scheduled = true
  await act(async () => root.render(React.createElement(BillingManagement, { initialResumeAvailable: true })))
  const button = text => [...document.querySelectorAll('button')].find(node => node.textContent === text)
  const click = async node => { assert.ok(node); await act(async () => node.click()) }
  assert.ok(button('Resume subscription'), 'Scheduled cancellation shows Resume subscription before opening the dialog')
  await click(button('Resume subscription'))
  assert.equal(document.querySelector('dialog').open, true)
  assert.equal(button('Confirm resume').disabled, true)
  assert.equal(resumed, 0, 'Opening Resume subscription must not restore billing')
  await click(button('Keep cancellation'))
  scheduled = false
  await click(button('Manage payment, invoices & cancellation'))
  assert.equal(document.querySelector('dialog').open, true)
  assert.ok(document.body.textContent.includes('4242'))
  await click(button('Update payment details'))
  assert.equal(button('Save payment details').disabled, true)
  await click(document.querySelector('input[type="checkbox"]'))
  await act(async () => document.querySelector('form').dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true })))
  assert.equal(saved, 1)
  await click(button('Cancel subscription'))
  assert.equal(button('Confirm cancellation').disabled, true)
  await click(button('Keep subscription'))
  assert.equal(cancelled, 0)
  await click(button('Cancel subscription'))
  await click(document.querySelector('input[type="checkbox"]'))
  assert.equal(button('Confirm cancellation').disabled, false)
  await click(button('Confirm cancellation'))
  assert.equal(cancelled, 1)
  assert.ok(!button('Cancel subscription'))
  await click(button('Resume subscription'))
  assert.equal(button('Confirm resume').disabled, true)
  await click(button('Keep cancellation'))
  assert.equal(resumed, 0)
  await click(button('Resume subscription'))
  await click(document.querySelector('input[type="checkbox"]'))
  await click(button('Confirm resume'))
  assert.equal(resumed, 1)
  assert.ok(button('Cancel subscription'))
  assert.ok(!button('Resume subscription'))
  status = 'canceled'
  await click(button('Manage payment, invoices & cancellation'))
  assert.ok(!button('Resume subscription'))
  assert.equal([...document.querySelectorAll('a')].find(node => node.textContent === 'Reactivate subscription').getAttribute('href'), '/billing#reactivate-plan')
  assert.equal(window.location.pathname, '/billing')
  await act(async () => root.unmount())
  dom.window.close()
  console.log('PASS: popup, card consent/save, cancellation confirmation, and no portal redirect')
}

services().then(dialog).catch(error => { console.error(error); process.exitCode = 1 })
