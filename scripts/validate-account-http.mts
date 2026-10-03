import { config } from 'dotenv'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
config({ path: '.env', quiet: true })
const { prisma } = await import('@awb/database')
const { hashPassword, tokenHash } = await import('../apps/web/src/lib/account-security')
const base = 'http://localhost:3000'
const id = randomUUID(), email = `http-${id}@validation.invalid`, password = `Temporary-validation-${id}`
const jar = new Map<string, string>()
const request = async (path: string, init: RequestInit = {}) => {
  const response = await fetch(base + path, { ...init, redirect: 'manual', headers: { ...init.headers, cookie: [...jar].map(([key, value]) => `${key}=${value}`).join('; ') }, signal: AbortSignal.timeout(60000) })
  for (const cookie of response.headers.getSetCookie()) { const pair = cookie.split(';')[0]!, index = pair.indexOf('='); jar.set(pair.slice(0, index), pair.slice(index + 1)) }
  return response
}
let userId = '', workspaceId = ''
try {
  for (const path of ['/signin', '/signup', '/pricing']) { const response = await request(path); assert.equal(response.status, 200, path); const html = await response.text(); assert.ok(html.includes('webtummy')); }
  assert.equal((await request('/dashboard')).status, 307)
  const user = await prisma.user.create({ data: { email, name: 'HTTP validation', passwordHash: await hashPassword(password), emailVerified: new Date(), memberships: { create: { role: 'OWNER', workspace: { create: { name: 'HTTP validation workspace', slug: `http-${id}` } } } } }, include: { memberships: true } })
  userId = user.id; workspaceId = user.memberships[0]!.workspaceId
  const project = await prisma.project.create({ data: { workspaceId, name: 'HTTP validation website', slug: `http-${id}`, previewHost: `http-${id}.invalid` } })
  const csrf = await (await request('/api/auth/csrf')).json() as { csrfToken: string }
  const login = await request('/api/auth/callback/password', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', origin: base, 'X-Auth-Return-Redirect': '1' }, body: new URLSearchParams({ csrfToken: csrf.csrfToken, email, password, callbackUrl: `${base}/dashboard` }) })
  assert.equal(login.status, 200)
  const session = await (await request('/api/auth/session')).json() as { user?: { id?: string } }
  assert.equal(session.user?.id, userId, 'Real password sign-in creates the correct session')
  for (const path of ['/dashboard', '/billing', '/account', '/team']) {
    const response = await request(path); const html = await response.text()
    assert.equal(response.status, 200, path)
    assert.ok(!html.includes('Sign in required'), path)
    if (path === '/dashboard') { assert.ok(html.includes('7-day trial')); assert.ok(html.includes('HTTP validation website')) }
  }
  assert.equal((await request('/admin')).status, 404, 'Non-admin cannot open administration')
  assert.equal((await request('/admin/emails')).status, 404, 'Non-admin cannot open email administration')
  const contact = await prisma.emailContact.findUniqueOrThrow({ where: { userId } })
  assert.ok(contact.firstLoginAt, 'First successful login starts sequence timing')
  assert.equal(contact.optedIn, false, 'Sign-in never implies promotional consent')
  await prisma.emailContact.update({ where: { userId }, data: { optedIn: true } })
  assert.equal((await request(`/api/email-unsubscribe?token=${contact.unsubscribeToken}`)).status, 303)
  assert.equal((await prisma.emailContact.findUniqueOrThrow({ where: { userId } })).optedIn, true, 'Link scanning GET does not unsubscribe')
  const unsubscribe = await fetch(`${base}/api/email-unsubscribe?token=${contact.unsubscribeToken}`, { method: 'POST', body: 'List-Unsubscribe=One-Click' })
  assert.equal(unsubscribe.status, 200)
  assert.equal((await prisma.emailContact.findUniqueOrThrow({ where: { userId } })).optedIn, false, 'Public one-click unsubscribe works without login')
  const publish = await request(`/projects/${project.id}/publishing`)
  assert.equal(publish.status, 307); assert.ok(publish.headers.get('location')?.startsWith('/billing'))
  assert.equal((await request(`/projects/${project.id}/editor`)).status, 200, 'Trial can access editor')
  await prisma.workspace.update({ where: { id: workspaceId }, data: { trialEndsAt: new Date(0) } })
  const expired = await request(`/projects/${project.id}/editor`)
  assert.equal(expired.status, 307); assert.ok(expired.headers.get('location')?.startsWith('/billing'))
  const dashboard = await request('/dashboard'); assert.equal(dashboard.status, 200); assert.ok((await dashboard.text()).includes('Trial ended'))
  const download = await request(`/api/projects/${project.id}/export`); assert.equal(download.status, 402)
  await prisma.user.update({ where: { id: userId }, data: { sessionVersion: { increment: 1 } } })
  assert.equal((await request('/dashboard')).status, 307, 'Revoked sessions cannot access protected pages')
  console.log('PASS: real local HTTP sign-in, public pages, trial dashboard, protected account/team/billing screens, admin denial, unpaid publishing redirect, expiry read-only access, export denial, first-login tracking, promotional consent, email-admin protection, one-click unsubscribe and session revocation. Temporary account removed; no email, OAuth or payment calls.')
} finally {
  if (workspaceId) await prisma.workspace.delete({ where: { id: workspaceId } })
  if (userId) await prisma.user.delete({ where: { id: userId } })
  const window = Math.floor(Date.now() / (15 * 60000))
  await prisma.authRateLimit.deleteMany({ where: { key: tokenHash(`login:${email}:${window}`) } })
  await prisma.$disconnect()
}
