import { config } from 'dotenv'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { encode } from 'next-auth/jwt'

config({ path: '.env', quiet: true })
const { prisma } = await import('@awb/database')
const base = process.env.BILLING_CHECK_URL || 'http://127.0.0.1:3003'
const unique = randomUUID()
let userId = '', workspaceId = ''
try {
  const end = new Date(Date.now() + 86400000)
  const plan = await prisma.billingPlan.findFirstOrThrow({ where: { active: true }, select: { id: true } })
  const user = await prisma.user.create({ data: {
    email: `billing-check-${unique}@validation.invalid`, name: 'Billing validation', emailVerified: new Date(), billingTrialUsedAt: new Date(),
    memberships: { create: { role: 'OWNER', workspace: { create: {
      name: 'Billing validation', slug: `billing-check-${unique}`, billingStatus: 'trialing', billingPlanId: plan.id,
      stripeCustomerId: `cus_validation_${unique}`, stripeSubscriptionId: `sub_validation_${unique}`,
      cancelAtPeriodEnd: true, billingTrialUsedAt: new Date(), billingTrialEnd: end, billingPeriodEnd: end,
    } } } },
  }, include: { memberships: true } })
  userId = user.id; workspaceId = user.memberships[0]!.workspaceId
  const cookies = await Promise.all(['authjs.session-token', '__Secure-authjs.session-token'].map(async salt => `${salt}=${await encode({ secret: process.env.AUTH_SECRET!, salt, token: { sub: user.id, sessionVersion: user.sessionVersion }, maxAge: 300 })}`))
  async function page() {
    const response = await fetch(`${base}/billing`, { headers: { cookie: cookies.join('; ') }, redirect: 'manual', signal: AbortSignal.timeout(30000) })
    assert.equal(response.status, 200)
    return response.text()
  }
  const cancelled = await page()
  assert.ok(cancelled.includes('Subscription cancelled — trial access continues'))
  assert.ok(cancelled.includes('Your subscription is scheduled to end on'))
  assert.ok(cancelled.includes('your card will not be charged unless you resume'))
  assert.match(cancelled, /<button[^>]*>Resume subscription<\/button>/)
  await prisma.workspace.update({ where: { id: workspaceId }, data: { cancelAtPeriodEnd: false } })
  const renewing = await page()
  assert.ok(renewing.includes('7-day free trial — full access'))
  assert.ok(renewing.includes('Your saved card will then be billed'))
  assert.doesNotMatch(renewing, /<button[^>]*>Resume subscription<\/button>/)
  console.log('PASS: billing HTML shows cancelled trial, end date and Resume subscription; renewing trial shows automatic billing. No Stripe writes or emails.')
} finally {
  if (workspaceId) await prisma.workspace.delete({ where: { id: workspaceId } })
  if (userId) await prisma.user.delete({ where: { id: userId } })
  await prisma.$disconnect()
}
