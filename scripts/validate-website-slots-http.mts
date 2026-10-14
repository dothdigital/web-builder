// Temporary database fixtures only; never contacts Stripe or sends email.
import 'dotenv/config'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { encode } from 'next-auth/jwt'
import { prisma } from '@awb/database'

const base = process.env.BILLING_CHECK_URL || 'http://127.0.0.1:3002'
const marker = `website-slots-check-${randomUUID()}`
let userId = '', workspaceId = ''
try {
  const plan = await prisma.billingPlan.findFirstOrThrow({ where: { active: true, slug: 'individual' }, select: { id: true } })
  const user = await prisma.user.create({ data: {
    email: `${marker}@validation.invalid`, name: 'Website slots validation', emailVerified: new Date(), billingTrialUsedAt: new Date(),
    memberships: { create: { role: 'OWNER', workspace: { create: {
      name: marker, slug: marker, billingStatus: 'active', billingPlanId: plan.id, billingWebsiteQuantity: 2,
      stripeCustomerId: `cus_${marker}`, stripeSubscriptionId: `sub_${marker}`, billingTrialUsedAt: new Date(),
      billingPaidThrough: new Date(Date.now() + 30 * 86400000), billingPeriodEnd: new Date(Date.now() + 30 * 86400000),
    } } } },
  }, include: { memberships: true } })
  userId = user.id; workspaceId = user.memberships[0]!.workspaceId
  const cookies = await Promise.all(['authjs.session-token', '__Secure-authjs.session-token'].map(async salt => `${salt}=${await encode({ secret: process.env.AUTH_SECRET!, salt, token: { sub: user.id, sessionVersion: user.sessionVersion }, maxAge: 300 })}`))
  const page = async (route: string) => fetch(`${base}${route}`, { headers: { cookie: cookies.join('; ') }, redirect: 'manual', signal: AbortSignal.timeout(30000) })
  let response = await page('/billing'); assert.equal(response.status, 200)
  let html = await response.text()
  assert.match(html, /2 website slots/); assert.match(html, /US\$58\/month/)
  assert.match(html, /Add website · \$29\/month/)
  assert.match(html, /Deleting a website frees its slot/)
  const project = await prisma.project.create({ data: { workspaceId, name: 'First website', slug: `${marker}-1`, previewHost: `${marker}-1.validation.invalid` } })
  response = await page(`/projects/${project.id}/publishing`); assert.equal(response.status, 200)
  html = await response.text()
  for (const branding of ['wt-brand', 'wt-sidebar', 'wt-topbar', 'Domains &amp; publishing']) assert.ok(html.includes(branding), `Publishing page must include ${branding}`)
  response = await page('/onboarding'); assert.equal(response.status, 200, 'A purchased second slot must allow onboarding')
  response = await page('/dashboard'); assert.equal(response.status, 200)
  html = await response.text(); assert.match(html, /\+ New website/)
  await prisma.project.create({ data: { workspaceId, name: 'Second website', slug: `${marker}-2`, previewHost: `${marker}-2.validation.invalid` } })
  response = await page('/onboarding'); assert.equal(response.status, 307)
  assert.match(response.headers.get('location') ?? '', /\/billing#website-slots$/)
  response = await page('/dashboard'); html = await response.text(); assert.match(html, /Add website · \$29\/month/)
  await prisma.workspaceMember.update({ where: { workspaceId_userId: { workspaceId, userId } }, data: { role: 'VIEWER' } })
  response = await page('/billing'); assert.equal(response.status, 200)
  html = await response.text()
  assert.doesNotMatch(html, /<button[^>]*>Add website · \$29\/month<\/button>/)
  assert.match(html, /Only a workspace owner can purchase/)
  await prisma.workspaceMember.update({ where: { workspaceId_userId: { workspaceId, userId } }, data: { role: 'OWNER' } })
  await prisma.workspace.update({ where: { id: workspaceId }, data: { billingStatus: 'trialing', billingWebsiteQuantity: 1, billingPaidThrough: null, billingTrialEnd: new Date(Date.now() + 7 * 86400000), billingPeriodEnd: new Date(Date.now() + 7 * 86400000) } })
  response = await page('/billing'); assert.equal(response.status, 200)
  html = await response.text()
  assert.match(html, /<button[^>]*>Upgrade \/ add new website<\/button>/)
  assert.doesNotMatch(html, /<button[^>]*disabled[^>]*>Upgrade \/ add new website<\/button>/)
  assert.match(html, /ends your free trial and starts paid monthly billing/)
  await prisma.workspace.update({ where: { id: workspaceId }, data: { cancelAtPeriodEnd: true } })
  response = await page('/billing'); html = await response.text()
  assert.match(html, /<button[^>]*disabled[^>]*>Upgrade \/ add new website<\/button>/)
  console.log('PASS: authenticated billing totals, capacity, owner-only UI, enabled trial upgrade and cancellation guard. No Stripe writes or emails.')
} finally {
  if (workspaceId) await prisma.workspace.delete({ where: { id: workspaceId } })
  if (userId) await prisma.user.delete({ where: { id: userId } })
  await prisma.$disconnect()
}
