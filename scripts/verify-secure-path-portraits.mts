import { config } from 'dotenv'
config({ path: '.env', override: true, quiet: true })
import assert from 'node:assert/strict'
import { writeFileSync } from 'node:fs'
import { encode } from 'next-auth/jwt'
const { prisma } = await import('@awb/database')
const projectId = 'cmv8r9j240000twpapiu39z6x'
try {
 const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId }, include: { workspace: { include: { members: { include: { user: true } } } } } })
 const user = project.workspace.members.find(m => m.role === 'OWNER')!.user
 const salt = '__Secure-authjs.session-token'
 const token = await encode({ secret: process.env.AUTH_SECRET!, salt, token: { sub: user.id, sessionVersion: user.sessionVersion }, maxAge: 600 })
 // Short-lived credential is kept out of logs and used only for this authorized preview verification.
 writeFileSync('/tmp/secure-path-browser-auth.json', JSON.stringify({ name: salt, value: token, domain: 'webtummy.com', path: '/', secure: true, httpOnly: true, sameSite: 'Lax' }), { mode: 0o600 })
 const version = await prisma.websiteVersion.findFirstOrThrow({ where: { projectId, kind: 'DRAFT' }, orderBy: { version: 'desc' } })
 const routes = (version.model as { pages: Array<{ path: string }> }).pages.map(page => page.path)
 for (const route of routes) {
  const response = await fetch(`https://webtummy.com/preview/${projectId}${route === '/' ? '' : route}`, { headers: { cookie: `${salt}=${token}` }, redirect: 'manual', signal: AbortSignal.timeout(30000) })
  assert.equal(response.status, 200, route)
  const html = await response.text()
  writeFileSync(`/tmp/secure-path-${route === '/' ? 'home' : route.slice(1).replaceAll('/', '-')}.html`, html)
  // Count actual rendered image tags, excluding serialized React payloads.
  const images = [...html.matchAll(/<img\b[^>]*>/g)].map(m => m[0])
  const portraits = images.filter(image => /whatsapp-image-2026-10-13/.test(image))
  assert.equal(portraits.length, ['/', '/about'].includes(route) ? 1 : 0, route)
  console.log(`${route}: HTTP 200; ${portraits.length} portrait(s) rendered`)
 }
 const hosting = await prisma.hostingSite.findUnique({ where: { projectId }, select: { previewHost: true, previewStatus: true } })
 console.log('Test hosting:', JSON.stringify(hosting))
} finally { await prisma.$disconnect() }
