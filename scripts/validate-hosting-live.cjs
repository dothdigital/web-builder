// Owner-authorized live infrastructure check. Creates a dedicated sample site;
// never invokes AI, payment, email or customer-account actions.
require('dotenv').config({ path: '.env', quiet: true })
const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const { randomBytes } = require('node:crypto')
global.React = require('react')
const { prisma } = require('@awb/database')
const { websiteModelSchema, validateWebsiteModel } = require('@awb/website-model')
const { defaultTokens, getComponent } = require('@awb/component-registry')
const { hashPassword } = require('../apps/web/src/lib/account-security')
const { withHostingLock, publishSite, syncBillingHosting } = require('../apps/web/src/lib/hosting/service')
const { deployPreview } = require('../apps/web/src/lib/hosting/preview')
const output = '/home/ubuntu/webtummy-hosting-live-verification.json'
const privateOutput = '/home/ubuntu/webtummy-hosting-test-account.json'
const component = (id, props = {}) => ({ componentId: id, componentVersion: '1.0.0', props: { ...getComponent(id).fixture, ...props } })
async function fetchPage(url) {
  const response = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(20000), cache: 'no-store' })
  return { status: response.status, robots: response.headers.get('x-robots-tag'), text: await response.text() }
}
async function main() {
  let fixture
  try { fixture = JSON.parse(await fs.readFile(privateOutput, 'utf8')) } catch (error) { if (error.code !== 'ENOENT') throw error }
  if (!fixture) {
    const suffix = randomBytes(5).toString('hex')
    const password = randomBytes(24).toString('base64url')
    const user = await prisma.user.create({ data: { email: `hosting-check-${suffix}@validation.invalid`, name: 'Webtummy hosting verification', emailVerified: new Date(), passwordHash: await hashPassword(password), memberships: { create: { role: 'OWNER', workspace: { create: { name: 'Webtummy deployment test', slug: `hosting-check-${suffix}`, billingExempt: true, billingExemptionReason: 'Owner-authorized hosting deployment verification' } } } } }, include: { memberships: true } })
    const project = await prisma.project.create({ data: { workspaceId: user.memberships[0].workspaceId, name: 'Webtummy Hosting Test', slug: `hosting-check-${suffix}`, previewHost: `hosting-check-${suffix}.validation.invalid`, hosting: { create: {} } } })
    fixture = { userId: user.id, email: user.email, password, workspaceId: project.workspaceId, projectId: project.id }
    await fs.writeFile(privateOutput, JSON.stringify(fixture), { mode: 0o600 })
  }
  const model = websiteModelSchema.parse({ schemaVersion: '1.0.0', site: { name: 'Webtummy Hosting Test', previewHost: 'hosting-test.webtummy.com' }, businessProfileRef: fixture.projectId, tokens: defaultTokens, designDna: { direction: 'corporate', composition: { symmetry: 'symmetric', density: 'balanced', width: 'wide', rhythm: 'modular' }, typography: { headingStyle: 'geometric-sans', bodyStyle: 'clean-sans', scale: 'standard' }, imagery: { style: 'documentary', dominance: 'medium', treatment: 'natural' }, navigation: 'split-nav', motion: 'none', corners: 'soft', ctaStyle: 'solid', colorBehavior: 'tonal' }, navigation: { primaryMenu: [] }, globalComponents: { header: component('HeaderSplitUtility'), footer: component('FooterCompact') }, pages: [{ id: 'home', path: '/', title: 'Webtummy Hosting Test', h1: 'Webtummy Hosting Test', seo: { title: 'Webtummy Hosting Test', description: 'A sample website for checking Webtummy managed hosting.', index: false }, sections: [{ id: 'hero', ...component('HeroTypographic', { heading: 'Webtummy Hosting Test' }) }] }] })
  const validation = validateWebsiteModel(model)
  assert.ok(validation.valid, JSON.stringify(validation))
  const latest = await prisma.websiteVersion.findFirst({ where: { projectId: fixture.projectId }, orderBy: { version: 'desc' } })
  await prisma.websiteVersion.create({ data: { projectId: fixture.projectId, version: (latest?.version ?? 0) + 1, schemaVersion: '1.0.0', model } })
  const preview = await withHostingLock(fixture.projectId, () => deployPreview(fixture.projectId, fixture.userId))
  assert.equal(preview.ready, true)
  const previewPage = await fetchPage(preview.url)
  assert.equal(previewPage.status, 200)
  assert.equal(previewPage.robots, 'noindex, nofollow')
  assert.ok(previewPage.text.includes('Webtummy Hosting Test'))
  assert.ok(previewPage.text.includes('noindex,nofollow'))
  assert.equal((await fetchPage(preview.url + '/robots.txt')).text, 'User-agent: *\nDisallow: /\n')
  assert.ok(!previewPage.text.includes('/api/visits'))
  await withHostingLock(fixture.projectId, () => publishSite(fixture.projectId, fixture.userId))
  let site = await prisma.hostingSite.findUniqueOrThrow({ where: { projectId: fixture.projectId } })
  assert.equal(site.status, 'LIVE')
  assert.equal(site.pendingReleaseId, null)
  const liveUrl = `https://${site.publicHost}`
  assert.equal((await fetchPage(liveUrl)).status, 200)
  const liveRelease = site.deployedReleaseId
  // A second draft deployment must not alter the live release.
  await withHostingLock(fixture.projectId, () => deployPreview(fixture.projectId, fixture.userId))
  site = await prisma.hostingSite.findUniqueOrThrow({ where: { projectId: fixture.projectId } })
  assert.equal(site.deployedReleaseId, liveRelease)
  assert.equal((await fetchPage(liveUrl)).status, 200)
  // Exercise suspension and restoration without triggering mail or payments.
  try {
    await prisma.workspace.update({ where: { id: fixture.workspaceId }, data: { status: 'SUSPENDED' } })
    await syncBillingHosting(fixture.projectId)
    assert.equal((await fetchPage(preview.url)).status, 503)
    assert.equal((await fetchPage(liveUrl)).status, 503)
  } finally {
    await prisma.workspace.update({ where: { id: fixture.workspaceId }, data: { status: 'ACTIVE' } })
    await syncBillingHosting(fixture.projectId)
  }
  assert.equal((await fetchPage(preview.url)).status, 200)
  assert.equal((await fetchPage(liveUrl)).status, 200)
  const previewMarker = JSON.parse((await fetchPage(preview.url + '/.well-known/webtummy-release')).text)
  const liveMarker = JSON.parse((await fetchPage(liveUrl + '/.well-known/webtummy-release')).text)
  assert.equal(previewMarker.projectId, fixture.projectId + '_preview')
  assert.equal(liveMarker.projectId, fixture.projectId)
  const result = { checkedAt: new Date().toISOString(), projectId: fixture.projectId, previewUrl: preview.url, liveUrl, serverId: site.serverId, storagePrefix: site.storagePrefix, previewReleaseId: previewMarker.releaseId, liveReleaseId: liveMarker.releaseId, checks: ['Real S3 release and recovery archive storage', 'Hosting server allocation and upload', 'Public Cloudflare HTTPS release verification', 'Preview noindex header, meta and robots.txt', 'Preview analytics disabled', 'Preview update preserves live release', 'Preview and live billing suspension/restoration'], customDomains: 'Blocked: Cloudflare SSL for SaaS quota not allocated', realAiEmailOrPaymentCalls: 0 }
  await fs.writeFile(output, JSON.stringify(result, null, 2))
  console.log(JSON.stringify(result, null, 2))
}
main().finally(() => prisma.$disconnect()).catch(error => { console.error(error); process.exitCode = 1 })
