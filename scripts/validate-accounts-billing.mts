import { config } from 'dotenv'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { build } from 'esbuild'
import { unlink } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
config({ path: '.env', override: true, quiet: true })
const { prisma } = await import('@awb/database')
const { paidAccess, editingAccess, assertWebsiteCapacity } = await import('../apps/web/src/lib/billing/access')
const { hashPassword, verifyPassword, tokenHash } = await import('../apps/web/src/lib/account-security')
const Stripe = (await import('stripe')).default
const prefix = `billing-test-${randomUUID()}`
const outfile = `${process.cwd()}/scripts/.${prefix}.mjs`
let userId = '', workspaceId = '', planId = ''
try {
  const hash = await hashPassword('a long validation password')
  assert.equal(await verifyPassword('a long validation password', hash), true)
  assert.equal(await verifyPassword('incorrect', hash), false)
  assert.equal(await verifyPassword('incorrect', null), false)
  assert.notEqual(hash, await hashPassword('a long validation password'), 'Passwords use random salts')
  assert.equal(tokenHash('token').length, 64)
  const user = await prisma.user.create({ data: { email: `${prefix}@validation.invalid`, passwordHash: hash, emailVerified: new Date(), memberships: { create: { role: 'OWNER', workspace: { create: { name: prefix, slug: prefix, trialWebsiteLimit: 1 } } } } }, include: { memberships: true } })
  userId = user.id; workspaceId = user.memberships[0]!.workspaceId
  let workspace = await prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId } })
  assert.equal(workspace.billingExempt, false)
  assert.ok(workspace.trialEndsAt.getTime() > Date.now() + 6.9 * 86400000)
  assert.equal(editingAccess(workspace), true); assert.equal(paidAccess(workspace), false, 'Trial cannot publish live')
  assert.equal(editingAccess({ ...workspace, trialEndsAt: new Date(0) }), false)
  assert.equal(editingAccess({ ...workspace, status: 'SUSPENDED' }), false)
  const create = () => prisma.$transaction(async tx => { await assertWebsiteCapacity(tx, workspaceId); return tx.project.create({ data: { workspaceId, name: prefix, slug: randomUUID(), previewHost: `${randomUUID()}.test.invalid` } }) })
  const concurrent = await Promise.allSettled([create(), create()])
  assert.equal(concurrent.filter(result => result.status === 'fulfilled').length, 1, 'Concurrent website creation cannot exceed limit')
  await prisma.workspace.update({ where: { id: workspaceId }, data: { trialEndsAt: new Date(0), stripeCustomerId: `cus_${prefix}` } })
  await assert.rejects(create, /trial has ended/)
  const plan = await prisma.billingPlan.create({ data: { slug: prefix, name: 'Test plan', description: 'Validation only', websiteLimit: 5, prices: { create: { stripePriceId: `price_${prefix}`, stripeProductId: `prod_${prefix}`, interval: 'month', amount: 2500, currency: 'cad' } } }, include: { prices: true } })
  planId = plan.id
  let status = 'active', subscriptionId = `sub_${prefix}`, priceId = plan.prices[0]!.stripePriceId, retrieveCalls = 0
  ;(globalThis as any).__billingStripe = { subscriptions: { retrieve: async () => { retrieveCalls++; return { id: subscriptionId, customer: `cus_${prefix}`, status, cancel_at_period_end: false, items: { data: [{ id: 'si_test', quantity: 1, current_period_end: Math.floor(Date.now() / 1000) + 86400, price: { id: priceId } }] } } } } }
  await build({ entryPoints: ['apps/web/src/lib/billing/service.ts'], outfile, bundle: true, platform: 'node', format: 'esm', packages: 'external', plugins: [{ name: 'mock-stripe-no-network', setup(b) { b.onResolve({ filter: /^\.\/stripe$/ }, () => ({ path: 'mock-stripe', namespace: 'mock' })); b.onLoad({ filter: /.*/, namespace: 'mock' }, () => ({ contents: 'export function stripeClient() { return globalThis.__billingStripe }', loader: 'js' })) } }] })
  const service = await import(pathToFileURL(outfile).href)
  const event = (suffix: string, type = 'customer.subscription.updated') => ({ id: `${prefix}-${suffix}`, type, data: { object: { id: subscriptionId, customer: `cus_${prefix}`, status: 'stale-value-ignored' } } })
  await service.processBillingEvent(event('active'))
  workspace = await prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId } })
  assert.equal(paidAccess(workspace), true); assert.equal(workspace.billingPlanId, planId)
  await service.processBillingEvent(event('active'))
  assert.equal(retrieveCalls, 1, 'Duplicate webhook is ignored transactionally')
  status = 'past_due'
  await service.processBillingEvent(event('late'))
  workspace = await prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId } })
  assert.equal(paidAccess(workspace), false); assert.equal(editingAccess(workspace), false)
  status = 'active'; priceId = 'price_unknown'
  await service.processBillingEvent(event('unknown'))
  assert.equal(paidAccess(await prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId } })), false, 'Unknown prices cannot grant access')
  priceId = plan.prices[0]!.stripePriceId
  await service.processBillingEvent(event('restore'))
  const activeId = subscriptionId
  subscriptionId = `sub_old_${prefix}`; status = 'canceled'
  await service.processBillingEvent(event('old-cancellation'))
  workspace = await prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId } })
  assert.equal(workspace.stripeSubscriptionId, activeId, 'Old cancelled subscription cannot revoke new subscription')
  assert.equal(paidAccess(workspace), true)
  const stripe = new Stripe('sk_test_validation_only')
  const payload = JSON.stringify({ id: 'evt_local', type: 'customer.subscription.updated', data: { object: {} } })
  const signature = stripe.webhooks.generateTestHeaderString({ payload, secret: 'whsec_validation_only' })
  assert.equal(stripe.webhooks.constructEvent(payload, signature, 'whsec_validation_only').id, 'evt_local')
  assert.throws(() => stripe.webhooks.constructEvent(payload + ' ', signature, 'whsec_validation_only'))
  console.log('PASS: password hashing, seven-day trial, live-domain denial, expiry, suspension, atomic website limits, webhook authentication, duplicate/late events, failed payments, unknown-price denial and old-subscription isolation. No emails or Stripe requests sent.')
} finally {
  if (workspaceId) await prisma.workspace.delete({ where: { id: workspaceId } })
  if (userId) await prisma.user.delete({ where: { id: userId } })
  if (planId) { await prisma.billingPrice.deleteMany({ where: { planId } }); await prisma.billingPlan.delete({ where: { id: planId } }) }
  await prisma.billingEvent.deleteMany({ where: { id: { startsWith: prefix } } })
  await unlink(outfile).catch(() => {})
  await prisma.$disconnect()
}
