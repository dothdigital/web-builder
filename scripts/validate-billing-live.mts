import 'dotenv/config'
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { createRequire } from 'node:module'
import { readFile, writeFile } from 'node:fs/promises'
import { prisma } from '@awb/database'
import { hashPassword } from '../apps/web/src/lib/account-security'
const { encodeReply } = createRequire(import.meta.url)('next/dist/compiled/react-server-dom-webpack/client.node.js')
const base = 'https://webtummy.com'
const marker = `billing-live-${Date.now()}`
const users: string[] = []; const workspaces: string[] = []
const evidence: { test: string; passed: boolean }[] = []
class Client {
  cookies = new Map<string, string>()
  async request(path: string, options: RequestInit = {}) {
    const response = await fetch(base + path, { ...options, redirect: 'manual', headers: { Cookie: [...this.cookies].map(([key, value]) => `${key}=${value}`).join('; '), ...options.headers } })
    for (const cookie of response.headers.getSetCookie()) { const pair = cookie.split(';')[0]!; const index = pair.indexOf('='); this.cookies.set(pair.slice(0, index), pair.slice(index + 1)) }
    return { status: response.status, headers: response.headers, text: await response.text() }
  }
  async login(email: string, password: string) {
    const csrf = JSON.parse((await this.request('/api/auth/csrf')).text).csrfToken
    await this.request('/api/auth/callback/password', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Origin: base }, body: new URLSearchParams({ csrfToken: csrf, email, password, callbackUrl: base + '/dashboard' }) })
    assert.ok(JSON.parse((await this.request('/api/auth/session')).text)?.user?.id)
  }
  async manage(workspaceId: string, operation: string) {
    const manifest = JSON.parse(await readFile('apps/web/.next/server/server-reference-manifest.json', 'utf8'))
    const entry = Object.entries(manifest.node).find(([, value]: any) => value.exportedName === 'manageWorkspace'); assert.ok(entry)
    const form = new FormData(); form.set('id', workspaceId); form.set('operation', operation)
    return this.request('/admin', { method: 'POST', headers: { 'Next-Action': entry[0], Origin: base }, body: await encodeReply([{ message: '' }, form]) })
  }
}
try {
  const clients: Record<string, Client> = {}
  for (const role of ['client', 'admin', 'support']) {
    const password = randomBytes(24).toString('base64url')
    const user = await prisma.user.create({ data: { email: `${marker}-${role}@security-test.invalid`, name: 'Disposable payment access check', emailVerified: new Date(), passwordHash: await hashPassword(password), ...(role === 'admin' ? { isPlatformAdmin: true } : role === 'support' ? { isPlatformSupport: true } : {}) } }); users.push(user.id)
    const workspace = await prisma.workspace.create({ data: { name: marker + '-' + role, slug: marker + '-' + role, members: { create: { userId: user.id, role: 'OWNER' } } } }); workspaces.push(workspace.id)
    const client = new Client(); await client.login(user.email, password); clients[role] = client
  }
  const regular = clients.client!, admin = clients.admin!, support = clients.support!
  const dashboard = await regular.request('/dashboard'); assert.equal(dashboard.status, 307); assert.ok(dashboard.headers.get('location')?.startsWith('/billing'))
  assert.equal((await regular.request('/onboarding')).status, 307)
  const billing = await regular.request('/billing'); assert.equal(billing.status, 200); assert.ok(billing.text.includes('Payment required before building')); assert.ok(billing.text.includes('No trial period.')); assert.ok(!billing.text.includes('Payments are temporarily unavailable'))
  assert.ok(!/<button[^>]*disabled=""[^>]*>Choose Individual/.test(billing.text)); assert.ok(billing.text.includes('name="priceId"'))
  evidence.push({ test: 'Unpaid existing/new clients reach billing; subscription checkout enabled and no trial access', passed: true })
  for (const [role, client] of [['admin', admin], ['support', support]] as const) {
    assert.equal((await client.request('/dashboard')).status, 200)
    assert.equal((await client.request('/onboarding')).status, 200)
    const staffBilling = await client.request('/billing'); assert.equal(staffBilling.status, 200); assert.ok(staffBilling.text.includes('Admin and support')); assert.ok(!staffBilling.text.includes('name="priceId"'))
    assert.equal((await prisma.workspace.findUniqueOrThrow({ where: { id: workspaces[role === 'admin' ? 1 : 2]! } })).billingExempt, true)
  }
  evidence.push({ test: 'Admin/support full access without payment and without checkout', passed: true })
  assert.equal((await support.request('/admin')).status, 404)
  for (const client of [regular, support]) { await client.manage(workspaces[0]!, 'exempt'); assert.equal((await prisma.workspace.findUniqueOrThrow({ where: { id: workspaces[0]! } })).billingExempt, false) }
  evidence.push({ test: 'Customers/support cannot grant payment exemptions', passed: true })
  const adminPage = await admin.request('/admin'); assert.equal(adminPage.status, 200); assert.ok(adminPage.text.includes('Skip payment')); assert.ok(adminPage.text.includes('Hold retention'))
  await admin.manage(workspaces[0]!, 'exempt'); assert.equal((await prisma.workspace.findUniqueOrThrow({ where: { id: workspaces[0]! } })).billingExempt, true)
  assert.equal((await regular.request('/dashboard')).status, 200); assert.equal((await regular.request('/onboarding')).status, 200)
  await admin.manage(workspaces[0]!, 'require-plan'); assert.equal((await regular.request('/dashboard')).status, 307)
  evidence.push({ test: 'Admin Skip payment grants full access; Require payment again blocks access', passed: true })
  await admin.manage(workspaces[0]!, 'hold-retention'); assert.equal((await prisma.workspace.findUniqueOrThrow({ where: { id: workspaces[0]! } })).billingLegalHold, true)
  await admin.manage(workspaces[0]!, 'release-hold'); assert.equal((await prisma.workspace.findUniqueOrThrow({ where: { id: workspaces[0]! } })).billingLegalHold, false)
  evidence.push({ test: 'Admin can apply and release retention holds', passed: true })
  const anonymous = new Client()
  const signup = await anonymous.request('/signup'); assert.equal(signup.status, 200); assert.ok(signup.text.includes('No trial period.')); assert.ok(!signup.text.includes('No payment required'))
  const terms = await anonymous.request('/terms'); assert.equal(terms.status, 200); assert.ok(terms.text.includes('90 days after suspension'))
  assert.equal((await anonymous.request('/api/internal/billing/sync', { method: 'POST' })).status, 401)
  const sweep = await fetch(base + '/api/internal/billing/sync', { method: 'POST', headers: { authorization: `Bearer ${process.env.BILLING_CRON_SECRET}` } }); assert.equal(sweep.status, 200)
  const result = await sweep.json() as { failed: number }; assert.equal(result.failed, 0)
  evidence.push({ test: 'No-trial signup, retention terms and authenticated billing scheduler', passed: true })
  await writeFile('/home/ubuntu/webtummy-security-20261005/billing-lifecycle-live.json', JSON.stringify(evidence, null, 2))
  console.log('PASS:', evidence.length, 'live payment gating, staff exemption, admin controls and scheduler checks. No Stripe checkout, emails or charges created.')
} finally {
  await prisma.auditEvent.deleteMany({ where: { OR: [{ workspaceId: { in: workspaces } }, { actorId: { in: users } }] } })
  await prisma.emailContact.deleteMany({ where: { userId: { in: users } } })
  await prisma.workspace.deleteMany({ where: { id: { in: workspaces } } })
  await prisma.user.deleteMany({ where: { id: { in: users } } })
  await prisma.$disconnect()
}
