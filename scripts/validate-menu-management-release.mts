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
const tag = 'menu-management-check-' + randomUUID()
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
  async function editor() {
    await page.goto(`https://webtummy.com/projects/${project.id}/editor`, { waitUntil: 'networkidle' })
    if (!await page.getByRole('button', { name: 'Business details', exact: true }).isVisible()) await page.locator('button[aria-controls="editor-right-panel"]').click()
  }
  await editor()
  await page.locator('footer').click({ position: { x: 140, y: 60 } })
  const footerManager = page.getByRole('region', { name: 'Footer menu management' })
  await footerManager.waitFor()
  await footerManager.getByRole('button', { name: 'Customize footer columns' }).click()
  await footerManager.getByLabel('Number of columns').selectOption('5')
  const column = footerManager.locator(':scope > details').nth(4)
  await column.locator('summary').first().click()
  await column.getByLabel('Column name', { exact: true }).fill('Selected links')
  await column.getByRole('button', { name: '+ Add custom link', exact: true }).click()
  const link = column.locator('details').first()
  await link.locator('summary').click()
  await link.getByLabel('Link name', { exact: true }).fill('Chosen contact')
  await link.getByLabel('Destination', { exact: true }).fill('/contact')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await page.getByText(/Saved as a new version/).waitFor()
  const savedVersion = await prisma.websiteVersion.findFirstOrThrow({ where: { projectId: project.id, kind: 'DRAFT' }, orderBy: { version: 'desc' } })
  const saved = websiteModelSchema.parse(savedVersion.model)
  const columns = saved.globalComponents.footer.props.columns as any[]
  assert.equal(columns.length, 5)
  assert.equal(columns[4].title, 'Selected links')
  assert.equal(columns[4].items[0].label, 'Chosen contact')
  assert.equal(saved.globalComponents.footer.props.layoutManaged, true)
  await mkdir('deploy/screenshots', { recursive: true })
  await page.screenshot({ path: 'deploy/screenshots/footer-menu-management.png' })
  await page.goto(`https://webtummy.com/preview/${project.id}/contact`, { waitUntil: 'networkidle' })
  assert.equal(await page.locator('footer nav').count(), 5)
  assert.equal(await page.locator('footer').getByRole('link', { name: 'Chosen contact', exact: true }).count(), 1)
  await editor()
  await page.locator('footer').click({ position: { x: 140, y: 60 } })
  assert.equal(await footerManager.getByLabel('Number of columns').inputValue(), '5')
  await page.locator('header [data-awb-element="/logoText"]').click()
  await page.getByRole('region', { name: 'Header menu management' }).waitFor()
  assert.deepEqual(errors, [])
  console.log('PASS: authenticated editor customizes five footer columns, names a column, adds a selected link, saves and reloads; preview renders all columns; separate header manager appears; no browser errors.')
} finally {
  await browser?.close()
  if (workspace) await prisma.workspace.delete({ where: { id: workspace.id } })
  if (user) await prisma.user.delete({ where: { id: user.id } })
  await prisma.$disconnect()
}
