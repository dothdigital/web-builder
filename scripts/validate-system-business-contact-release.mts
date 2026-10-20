import { config } from 'dotenv'
config({ path: '.env', quiet: true })
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { mkdir } from 'node:fs/promises'
import { encode } from 'next-auth/jwt'
import { websiteModelSchema } from '@awb/website-model'
import { getComponent, defaultTokens } from '@awb/component-registry'
const { prisma } = await import('@awb/database')
const { chromium } = await import('/tmp/webtummy-ui-check/node_modules/playwright/index.mjs')
const tag = 'system-contact-check-' + randomUUID()
let workspace: any, user: any, browser: any
try {
  workspace = await prisma.workspace.create({ data: { name: tag, slug: tag, billingExempt: true, billingExemptionReason: 'Isolated business details release check' } })
  user = await prisma.user.create({ data: { email: tag + '@example.invalid', name: 'Business details verification', emailVerified: new Date(), memberships: { create: { workspaceId: workspace.id, role: 'OWNER' } } } })
  const project = await prisma.project.create({ data: { workspaceId: workspace.id, name: tag, slug: tag, previewHost: tag + '.preview.local', businessProfile: { create: { displayName: 'Intake business', description: 'Original intake description', email: 'intake@example.com', phone: '+1 555 1000', addressLine1: '10 Intake Street', missingFacts: [] } }, socialLinks: { create: { network: 'Facebook', url: 'https://facebook.com/example', position: 0 } } } })
  const seed = await prisma.websiteVersion.findFirstOrThrow({ where: { kind: 'DRAFT' }, orderBy: { createdAt: 'asc' } })
  const model = websiteModelSchema.parse(seed.model)
  const header = getComponent('HeaderSplitUtility')!, footer = getComponent('FooterEditorial')!, hero = getComponent('HeroEditorial')!
  model.site = { name: 'Intake business', previewHost: project.previewHost, locale: 'en' }
  model.businessProfileRef = project.id
  model.businessDetails = undefined
  model.tokens = structuredClone(defaultTokens)
  model.contact = { email: 'intake@example.com', phone: '+1 555 1000', addressLine1: '10 Intake Street', hours: [] }
  model.socials = [{ network: 'Facebook', url: 'https://facebook.com/example' }]
  model.navigation = { primaryMenu: [] }
  model.customScripts = undefined
  model.globalComponents = { header: { componentId: header.componentId, componentVersion: header.version, props: { ...header.fixture as object, logoText: 'Intake business' } }, footer: { componentId: footer.componentId, componentVersion: footer.version, props: { ...footer.fixture as object, businessName: 'Intake business' } } }
  model.pages = [{ id: 'home', path: '/', title: 'Home', h1: 'Home', pageType: 'CUSTOM', seo: { title: 'Home', description: '', index: false }, sections: [{ id: 'hero', componentId: hero.componentId, componentVersion: hero.version, hidden: false, props: { ...hero.fixture as object, heading: 'Intake business', imageUrl: '' } }] }]
  const contactSection = getComponent('ContactSplit')!
  model.pages[0]!.id = 'contact'
  model.pages[0]!.path = '/contact'
  model.pages[0]!.title = 'Contact'
  model.pages[0]!.sections.push({ id: 'contact-details', componentId: contactSection.componentId, componentVersion: contactSection.version, hidden: false, props: { ...contactSection.fixture as object, address: 'Stale address', email: 'stale@example.com', phone: '+1 555 9999' } })
  await prisma.websiteVersion.create({ data: { projectId: project.id, version: 1, kind: 'DRAFT', schemaVersion: model.schemaVersion, model: JSON.parse(JSON.stringify(model)) } })
  const salt = '__Secure-authjs.session-token'
  const token = await encode({ secret: process.env.AUTH_SECRET!, salt, token: { sub: user.id, sessionVersion: user.sessionVersion }, maxAge: 900 })
  browser = await chromium.launch({ headless: true, args: ['--no-sandbox'], env: { ...process.env, LD_LIBRARY_PATH: '/tmp/webtummy-browser-libs/root/usr/lib/x86_64-linux-gnu' } })
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } })
  await context.addCookies([{ name: salt, value: token, domain: 'webtummy.com', path: '/', secure: true, httpOnly: true, sameSite: 'Lax' }])
  if (process.env.UI_CHECK_BASE) await context.route('https://webtummy.com/**', async route => {
    const response = await route.fetch({ url: route.request().url().replace('https://webtummy.com', process.env.UI_CHECK_BASE!), headers: { ...route.request().headers(), host: 'webtummy.com', 'x-forwarded-host': 'webtummy.com', 'x-forwarded-proto': 'https' }, maxRedirects: 0 })
    await route.fulfill({ response })
  })
  const page = await context.newPage()
  const errors: string[] = []
  page.on('pageerror', (error: Error) => errors.push(error.message))
  async function openDetails() {
    await page.goto(`https://webtummy.com/projects/${project.id}/editor`, { waitUntil: 'networkidle' })
    if (!await page.getByRole('button', { name: 'Business details', exact: true }).isVisible()) await page.locator('button[aria-controls="editor-right-panel"]').click()
    await page.getByRole('button', { name: 'Business details', exact: true }).click()
  }
  async function save() {
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await page.getByText(/Saved as a new version/).waitFor()
    const saved = await prisma.websiteVersion.findFirstOrThrow({ where: { projectId: project.id, kind: 'DRAFT' }, orderBy: { version: 'desc' } })
    return websiteModelSchema.parse(saved.model)
  }
  await openDetails()
  assert.equal(await page.getByLabel('Business name', { exact: true }).inputValue(), 'Intake business')
  assert.equal(await page.getByLabel('email 1', { exact: true }).inputValue(), 'intake@example.com')
  await page.getByLabel('Address line 1', { exact: true }).fill('25 Updated Avenue')
  await page.getByLabel('email 1', { exact: true }).fill('main@example.com')
  await page.getByRole('button', { name: '+ Add email', exact: true }).click()
  await page.getByLabel('email 2', { exact: true }).fill('team@example.com')
  await page.getByLabel('phone 1', { exact: true }).fill('+1 555 2000')
  await page.getByRole('button', { name: '+ Add phone', exact: true }).click()
  await page.getByLabel('phone 2', { exact: true }).fill('+1 555 3000')
  await page.getByRole('combobox', { name: /^Platform/ }).selectOption('Instagram')
  await page.getByLabel('Profile URL', { exact: true }).fill('https://instagram.com/example')
  assert.equal(await page.locator('footer a[href="mailto:team@example.com"]').count(), 1)
  assert.equal(await page.locator('footer a[href="tel:+1 555 3000"]').count(), 1)
  assert.equal(await page.locator('footer a[aria-label="Instagram"]').count(), 1)
  const contactDetails = page.locator('[data-awb-business-contact]')
  assert.equal(await contactDetails.locator('a[href="mailto:team@example.com"]').count(), 1)
  assert.equal(await contactDetails.locator('a[href="tel:+1 555 3000"]').count(), 1)
  assert.equal(await contactDetails.locator('a[aria-label="Instagram"]').count(), 1)
  assert.ok((await contactDetails.textContent())!.includes('25 Updated Avenue'))
  assert.equal(await page.locator('a[href="mailto:stale@example.com"]').count(), 0)
  const saved = await save()
  assert.deepEqual(saved.contact.emails, ['main@example.com', 'team@example.com'])
  assert.deepEqual(saved.contact.phones, ['+1 555 2000', '+1 555 3000'])
  assert.equal(saved.contact.addressLine1, '25 Updated Avenue')
  const profile = await prisma.businessProfile.findUniqueOrThrow({ where: { projectId: project.id } })
  assert.equal(profile.email, 'main@example.com')
  assert.equal(profile.phone, '+1 555 2000')
  assert.equal(profile.addressLine1, '25 Updated Avenue')
  assert.equal((await prisma.socialLink.findFirstOrThrow({ where: { projectId: project.id } })).network, 'Instagram')
  await openDetails()
  assert.equal(await page.getByLabel('email 2', { exact: true }).inputValue(), 'team@example.com')
  assert.equal(await page.getByLabel('phone 2', { exact: true }).inputValue(), '+1 555 3000')
  assert.equal(await page.getByLabel('Address line 1', { exact: true }).inputValue(), '25 Updated Avenue')
  assert.equal(await page.getByRole('combobox', { name: /^Platform/ }).inputValue(), 'Instagram')
  await mkdir('deploy/screenshots', { recursive: true })
  await page.screenshot({ path: 'deploy/screenshots/business-details-editor.png' })
  await page.goto(`https://webtummy.com/preview/${project.id}/contact`, { waitUntil: 'networkidle' })
  assert.equal(await page.locator('main [data-awb-business-contact] a[href="mailto:team@example.com"]').count(), 1)
  assert.equal(await page.locator('main [data-awb-business-contact] a[aria-label="Instagram"]').count(), 1)
  assert.ok((await page.locator('main [data-awb-business-contact]').textContent())!.includes('25 Updated Avenue'))
  await page.screenshot({ path: 'deploy/screenshots/system-contact-preview.png', fullPage: true })
  await openDetails()
  await page.getByRole('button', { name: 'Remove email 1', exact: true }).click()
  await page.getByRole('button', { name: 'Remove phone 1', exact: true }).click()
  await page.getByRole('button', { name: 'Remove social icon', exact: true }).click()
  await page.getByLabel('Address line 1', { exact: true }).fill('')
  assert.equal(await page.locator('footer a[aria-label="Instagram"]').count(), 0)
  const removed = await save()
  assert.equal(removed.contact.email, 'team@example.com')
  assert.equal(removed.contact.phone, '+1 555 3000')
  assert.equal(removed.socials.length, 0)
  assert.equal(await prisma.socialLink.count({ where: { projectId: project.id } }), 0)
  assert.equal((await prisma.businessProfile.findUniqueOrThrow({ where: { projectId: project.id } })).addressLine1, null)
  await openDetails()
  assert.equal(await page.getByLabel('email 1', { exact: true }).inputValue(), 'team@example.com')
  assert.equal(await page.getByRole('button', { name: 'Remove social icon', exact: true }).count(), 0)
  assert.equal(await page.locator('[data-awb-business-contact] a[href="mailto:main@example.com"]').count(), 0)
  assert.equal(await page.locator('[data-awb-business-contact] a[aria-label="Instagram"]').count(), 0)
  assert.equal(await page.locator('[data-awb-business-contact] a[href="mailto:team@example.com"]').count(), 1)
  assert.deepEqual(errors, [])
  console.log('PASS: Contact page in the editor and preview shows canonical address, all contacts and social icons; save and reload persist updates; removals clear page and footer; no browser errors.')
} finally {
  await browser?.close()
  if (workspace) await prisma.workspace.delete({ where: { id: workspace.id } })
  if (user) await prisma.user.delete({ where: { id: user.id } })
  await prisma.$disconnect()
}
