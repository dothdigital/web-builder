import 'dotenv/config'
import assert from 'node:assert/strict'
import { runInNewContext } from 'node:vm'
import { prisma } from '@awb/database'
import { billingLifecycle, BILLING_DAY } from '@awb/database/billing-policy'
import { syncSubscription } from '../apps/web/src/lib/billing/service'
import { reconcileBillingLifecycle } from '../apps/web/src/lib/billing/lifecycle'
import { suspensionFunction } from '../apps/web/src/lib/hosting/aws'
import { ensureAccountWorkspace } from '../apps/web/src/lib/social-auth'
import { canGenerate } from '../packages/pipeline/src/billing-access'

const now = new Date('2026-10-05T18:00:00Z')
const paid = { status: 'ACTIVE', billingExempt: false, billingStatus: 'active', billingPlanId: 'plan_solo', billingPeriodEnd: new Date(now.getTime() + 30 * BILLING_DAY), billingPaidThrough: new Date(now.getTime() + 30 * BILLING_DAY) }
assert.equal(billingLifecycle({ ...paid, billingPaidThrough: null }, now).phase, 'PAYMENT_REQUIRED')
assert.equal(billingLifecycle({ ...paid, billingStatus: 'trialing' }, now).editing, false)
assert.equal(billingLifecycle({ ...paid, billingPlanId: null, billingExempt: true }, now).editing, true)
for (const [days, phase, editing, hosting] of [[0, 'GRACE', true, true], [6.999, 'GRACE', true, true], [7, 'PAST_DUE', false, true], [29.999, 'PAST_DUE', false, true], [30, 'SUSPENDED', false, false]] as const) {
  const state = billingLifecycle({ ...paid, billingStatus: 'past_due', billingPaidThrough: new Date(now.getTime() - BILLING_DAY), billingDelinquentSince: new Date(now.getTime() - days * BILLING_DAY) }, now)
  assert.deepEqual([state.phase, state.editing, state.hosting], [phase, editing, hosting])
}
assert.equal(billingLifecycle({ ...paid, cancelAtPeriodEnd: true }, now).editing, true)
const cancellationEnd = new Date(now.getTime() - BILLING_DAY)
const delayedCancellation = billingLifecycle({ ...paid, cancelAtPeriodEnd: true, billingPaidThrough: cancellationEnd, billingPeriodEnd: cancellationEnd }, now)
assert.equal(delayedCancellation.phase, 'SUSPENDED', 'Scheduled cancellation has no failed-payment grace, even before its webhook arrives')
assert.equal(delayedCancellation.suspendAt?.getTime(), cancellationEnd.getTime())
assert.equal(delayedCancellation.retentionEndsAt?.getTime(), cancellationEnd.getTime() + 90 * BILLING_DAY)
assert.equal(billingLifecycle({ ...paid, billingStatus: 'past_due', cancelAtPeriodEnd: true, billingPaidThrough: cancellationEnd, billingDelinquentSince: cancellationEnd }, now).phase, 'GRACE', 'Scheduling cancellation during a failed-payment grace period does not end grace early')
assert.equal(billingLifecycle({ ...paid, billingStatus: 'canceled', billingSubscriptionEndedAt: now }, now).hosting, false)
assert.equal(billingLifecycle({ ...paid, billingStatus: 'canceled', billingCancellationReason: 'payment_failed', billingDelinquentSince: new Date(now.getTime() - 15 * BILLING_DAY) }, now).hosting, true)
assert.equal(billingLifecycle({ ...paid, billingDelinquentSince: new Date(now.getTime() - 60 * BILLING_DAY) }, now).phase, 'ACTIVE')
assert.equal(billingLifecycle({ ...paid, billingStatus: 'canceled', billingSubscriptionEndedAt: new Date(now.getTime() - 91 * BILLING_DAY), billingLegalHold: true }, now).deletionEligible, false)
const gate = runInNewContext(suspensionFunction() + '; handler({request:{uri:"/private-path"}})')
assert.equal(gate.statusCode, 503)
assert.equal(gate.headers['cache-control'].value, 'no-store')
assert.ok(gate.body.data.includes('temporarily unavailable'))
assert.ok(!/payment|subscription|Webtummy|private-path/i.test(gate.body.data))
console.log('PASS: no initial/trial access, exemptions, exact grace boundaries, cancellation, recovery, legal hold and neutral public suspension.')

const marker = `billing-regression-${Date.now()}`
const workspaces: string[] = []; const users: string[] = []; const events: string[] = []
try {
  const price = await prisma.billingPrice.findFirstOrThrow({ where: { planId: 'plan_solo', active: true, amount: 2900, currency: 'usd', interval: 'month' } })
  const workspace = await prisma.workspace.create({ data: { name: marker, slug: marker, stripeCustomerId: `cus_${marker}` } }); workspaces.push(workspace.id)
  const end = Math.floor(Date.now() / 1000) + 30 * 86400
  let subscription: any = { id: `sub_${marker}`, customer: workspace.stripeCustomerId, status: 'active', cancel_at_period_end: false, ended_at: null, cancellation_details: null, items: { data: [{ id: 'si_fixture', quantity: 1, current_period_end: end, price: { id: price.stripePriceId } }] }, latest_invoice: { id: 'in_fixture', created: Math.floor(Date.now() / 1000), status: 'paid', attempted: true, lines: { data: [{ parent: { type: 'subscription_item_details' }, pricing: { price_details: { price: price.stripePriceId } }, period: { end } }] } } }
  let oldOutstanding: any = null
  const client = { invoices: { retrieve: async () => structuredClone(subscription.latest_invoice), list: async () => ({ data: oldOutstanding ? [oldOutstanding] : subscription.latest_invoice.status === 'open' ? [subscription.latest_invoice] : [], has_more: false }) }, subscriptions: { retrieve: async () => structuredClone(subscription) } } as any
  const event = (type: string) => { const id = `evt_${marker}_${events.length}`; events.push(id); return { id, type, created: Math.floor(Date.now() / 1000), data: { object: { id: subscription.latest_invoice.id } } } as any }
  const success = event('invoice.paid')
  await syncSubscription(workspace.id, subscription.id, success, client)
  await syncSubscription(workspace.id, subscription.id, success, client)
  assert.equal(await prisma.billingEvent.count({ where: { id: success.id } }), 1)
  assert.equal(billingLifecycle(await prisma.workspace.findUniqueOrThrow({ where: { id: workspace.id } })).phase, 'ACTIVE')
  subscription.status = 'past_due'; subscription.latest_invoice.status = 'open'; subscription.latest_invoice.next_payment_attempt = Math.floor(Date.now() / 1000) + 86400
  await syncSubscription(workspace.id, subscription.id, event('invoice.payment_failed'), client)
  const failure = await prisma.workspace.findUniqueOrThrow({ where: { id: workspace.id } })
  assert.ok(failure.billingPaidThrough && failure.billingDelinquentSince && failure.billingNextRetryAt)
  const anchored = failure.billingDelinquentSince.getTime()
  await syncSubscription(workspace.id, subscription.id, event('invoice.updated'), client)
  assert.equal((await prisma.workspace.findUniqueOrThrow({ where: { id: workspace.id } })).billingDelinquentSince!.getTime(), anchored)
  subscription.status = 'active'; subscription.latest_invoice.status = 'paid'
  await syncSubscription(workspace.id, subscription.id, event('invoice.payment_failed'), client)
  assert.equal((await prisma.workspace.findUniqueOrThrow({ where: { id: workspace.id } })).billingDelinquentSince, null)
  oldOutstanding = { ...subscription.latest_invoice, id: 'in_old_outstanding', status: 'open', created: Math.floor(Date.now() / 1000) - 15 * 86400 }
  await syncSubscription(workspace.id, subscription.id, event('invoice.paid'), client)
  assert.equal((await prisma.workspace.findUniqueOrThrow({ where: { id: workspace.id } })).billingStatus, 'past_due')
  assert.ok((await prisma.workspace.findUniqueOrThrow({ where: { id: workspace.id } })).billingDelinquentSince)
  oldOutstanding = null
  await syncSubscription(workspace.id, subscription.id, event('invoice.paid'), client)
  assert.equal((await prisma.workspace.findUniqueOrThrow({ where: { id: workspace.id } })).billingDelinquentSince, null)
  const suspended = new Date(Date.now() - 91 * BILLING_DAY)
  await prisma.workspace.update({ where: { id: workspace.id }, data: { billingStatus: 'canceled', billingSubscriptionEndedAt: suspended, billingSuspendedAt: suspended, billingRetentionEndsAt: new Date(suspended.getTime() + 90 * BILLING_DAY), billingDelinquentSince: null } })
  await reconcileBillingLifecycle(workspace.id)
  assert.equal((await prisma.workspace.findUniqueOrThrow({ where: { id: workspace.id } })).billingDeletionEligibleAt, null)
  for (const [index, kind] of ['RETENTION_30', 'RETENTION_7'].entries()) await prisma.billingNotice.create({ data: { workspaceId: workspace.id, dedupeKey: `${marker}:${kind}`, cycleKey: suspended.toISOString(), kind, recipient: 'fixture@security-test.invalid', subject: 'Fixture', body: 'Fixture — not sent', status: 'SENT', sentAt: new Date(Date.now() - (3 - index) * BILLING_DAY) } })
  await reconcileBillingLifecycle(workspace.id)
  assert.ok((await prisma.workspace.findUniqueOrThrow({ where: { id: workspace.id } })).billingDeletionEligibleAt)
  await prisma.workspace.update({ where: { id: workspace.id }, data: { billingLegalHold: true } })
  await reconcileBillingLifecycle(workspace.id)
  assert.equal((await prisma.workspace.findUniqueOrThrow({ where: { id: workspace.id } })).billingDeletionEligibleAt, null)
  assert.ok(await prisma.workspace.findUnique({ where: { id: workspace.id } }))
  for (const role of ['admin', 'support'] as const) {
    const user = await prisma.user.create({ data: { email: `${marker}-${role}@security-test.invalid`, ...(role === 'admin' ? { isPlatformAdmin: true } : { isPlatformSupport: true }) } }); users.push(user.id)
    await ensureAccountWorkspace(user.id)
    const membership = await prisma.workspaceMember.findFirstOrThrow({ where: { userId: user.id }, include: { workspace: true } }); workspaces.push(membership.workspaceId)
    assert.equal(membership.workspace.billingExempt, true)
    assert.equal(membership.workspace.billingExemptionReason, 'staff')
    assert.equal(billingLifecycle(membership.workspace).editing, true)
  }
  const project = await prisma.project.create({ data: { workspaceId: workspace.id, name: marker, slug: marker, previewHost: `${marker}.security-test.invalid` } })
  assert.equal(await canGenerate(project.id), false)
  const job = await prisma.contentJob.create({ data: { projectId: project.id, workspaceId: workspace.id, requestedBy: users[1]!, kind: 'PATCH', title: 'Fixture — never queued', status: 'READY', input: {} } })
  assert.equal(await canGenerate(project.id, job.id), true)
  await prisma.user.update({ where: { id: users[1]! }, data: { isPlatformSupport: false } })
  assert.equal(await canGenerate(project.id, job.id), false)
  console.log('PASS: authoritative paid-invoice access, webhook idempotency/reordering, stable delinquency, warning-gated retention review, staff-free workspaces and unpaid AI rejection. No Stripe calls, emails or charges.')
} finally {
  await prisma.auditEvent.deleteMany({ where: { workspaceId: { in: workspaces } } })
  await prisma.workspace.deleteMany({ where: { id: { in: workspaces } } })
  await prisma.user.deleteMany({ where: { id: { in: users } } })
  await prisma.billingEvent.deleteMany({ where: { id: { in: events } } })
  await prisma.$disconnect()
}
