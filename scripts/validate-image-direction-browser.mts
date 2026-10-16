import { config } from 'dotenv'
config({ path: '.env', quiet: true })
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import { encode } from 'next-auth/jwt'
import { intakeMediaSchema } from '@awb/shared/intake-media'
const { prisma } = await import('@awb/database')
const { chromium } = await import('/tmp/webtummy-ui-check/node_modules/playwright/index.mjs')
const tag = `image-direction-${randomUUID()}`
const workspace = await prisma.workspace.create({ data: { name: tag, slug: tag, billingExempt: true, billingExemptionReason: 'Temporary UI verification' } })
const user = await prisma.user.create({ data: { email: `${tag}@example.invalid`, name: 'UI verification', emailVerified: new Date(), memberships: { create: { workspaceId: workspace.id, role: 'OWNER' } } } })
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined
let context: any
let closing = false
try {
 browser = await chromium.launch({ headless: true, args: ['--no-sandbox'], env: { ...process.env, LD_LIBRARY_PATH: '/tmp/webtummy-browser-libs/root/usr/lib/x86_64-linux-gnu' } })
 context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
 const salt = '__Secure-authjs.session-token'
 const token = await encode({ secret: process.env.AUTH_SECRET!, salt, token: { sub: user.id, sessionVersion: user.sessionVersion }, maxAge: 600 })
 await context.addCookies([{ name: salt, value: token, domain: 'webtummy.com', path: '/', secure: true, httpOnly: true, sameSite: 'Lax' }])
 const candidate = process.env.UI_CHECK_BASE
 if (candidate) await context.route('https://webtummy.com/**', async (route: any) => {
  try {
  const response = await route.fetch({ url: route.request().url().replace('https://webtummy.com', candidate), headers: { ...route.request().headers(), host: 'webtummy.com', 'x-forwarded-host': 'webtummy.com', 'x-forwarded-proto': 'https' }, maxRedirects: 0 })
  await route.fulfill({ response })
  } catch { if (!closing) await route.abort().catch(() => {}) }
 })
 const page = await context.newPage()
 const errors: string[] = []
 page.on('pageerror', e => errors.push(e.message))
 await page.goto('https://webtummy.com/onboarding')
 await page.getByLabel('Business name', { exact: true }).fill(tag)
 await page.getByRole('textbox', { name: /What does the business do\?/ }).fill('A synthetic local planning business for testing image preferences.')
 await page.getByRole('button', { name: 'Continue', exact: true }).click()
 await page.getByRole('button', { name: 'Continue — let AI choose', exact: true }).click()
 const styles = page.getByRole('group', { name: 'Generated image style', exact: true })
 await styles.waitFor()
 assert.equal(await styles.getByRole('checkbox').count(), 5)
 await page.locator('input[name=imageMode]').nth(1).check()
 await styles.getByLabel('People and human moments', { exact: true }).check()
 await styles.getByLabel('Local places and community', { exact: true }).check()
 await styles.getByLabel('Visual direction (optional)', { exact: true }).fill('Natural editorial photography in Canadian neighbourhoods.')
 await page.locator('input[name=imageMode]').nth(0).check()
 assert.equal(await styles.count(), 0)
 await page.locator('input[name=imageMode]').nth(2).check()
 assert.ok(await styles.getByLabel('People and human moments', { exact: true }).isChecked())
 const out = process.env.IMAGE_UI_ARTIFACTS || '/tmp/webtummy-image-direction-check'
 mkdirSync(out, { recursive: true })
 await page.screenshot({ path: `${out}/intake-desktop.png`, fullPage: true })
 await page.setViewportSize({ width: 390, height: 844 })
 assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
 await page.screenshot({ path: `${out}/intake-mobile.png`, fullPage: true })
 await page.getByRole('button', { name: 'Continue', exact: true }).click()
 await page.getByRole('heading', { name: 'Social media', exact: true }).waitFor()
 const project = await prisma.project.findFirstOrThrow({ where: { workspaceId: workspace.id } })
 const media = intakeMediaSchema.parse(project.intakeMedia)
 assert.deepEqual(media.imageDirection?.styles, ['people', 'local'])
 assert.match(media.imageDirection!.notes, /Canadian neighbourhoods/)
 const { StubAiProvider } = await import('@awb/ai')
 const { defaultTokens, getComponent, listComponents } = await import('@awb/component-registry')
 const { websiteModelSchema } = await import('@awb/website-model')
 const brief = { businessName: tag, description: 'Synthetic interface verification', services: [], goals: [], tonePreferences: [], answers: {}, hasLogo: false, logoColors: [], uploadedImageUrls: [], testimonials: [] }
 const stub = new StubAiProvider({ seed: tag })
 const dna = (await stub.proposeDesignDirections(brief, (await stub.analyzeBrief(brief)).data)).data.options[0]!.dna
 const header = listComponents().find(c => c.family === 'HEADER')!, footer = listComponents().find(c => c.family === 'FOOTER')!, hero = getComponent('HeroEditorial')!
 const model = websiteModelSchema.parse({ schemaVersion: '1.0.0', site: { name: tag, previewHost: project.previewHost }, businessProfileRef: project.id, designDna: dna, tokens: defaultTokens, navigation: { primaryMenu: [] }, globalComponents: { header: { componentId: header.componentId, props: header.fixture }, footer: { componentId: footer.componentId, props: footer.fixture } }, pages: [{ id: 'home', path: '/', title: 'Home', h1: tag, seo: { title: tag, description: brief.description }, sections: [{ id: 'hero', componentId: hero.componentId, props: { ...hero.fixture as object, heading: tag } }] }] })
 await prisma.websiteVersion.create({ data: { projectId: project.id, version: 1, kind: 'DRAFT', schemaVersion: '1.0.0', model } })
 await page.setViewportSize({ width: 1440, height: 1000 })
 await page.goto('https://webtummy.com/dashboard')
 await page.getByRole('button', { name: 'Rerun with AI', exact: true }).click()
 const dialog = page.getByRole('dialog', { name: 'Rerun with AI', exact: true })
 assert.equal(await styles.count(), 0)
 await dialog.locator('input[value=IMAGES]').check()
 assert.ok(await styles.getByLabel('People and human moments', { exact: true }).isChecked())
 assert.ok(await styles.getByLabel('Local places and community', { exact: true }).isChecked())
 await styles.getByLabel('Illustrations and abstract visuals', { exact: true }).check()
 await page.screenshot({ path: `${out}/rerun-desktop.png`, fullPage: true })
 await dialog.locator('input[value=FULL]').check()
 assert.ok(await styles.getByLabel('Illustrations and abstract visuals', { exact: true }).isChecked())
 await page.setViewportSize({ width: 390, height: 844 })
 assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
 await page.screenshot({ path: `${out}/rerun-mobile.png`, fullPage: true })
 await dialog.locator('input[value=UPLOADS]').check()
 assert.equal(await styles.count(), 0)
 await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
 assert.equal(await prisma.contentJob.count({ where: { workspaceId: workspace.id } }), 0)
 assert.deepEqual(errors, [])
 console.log('PASS: real intake saves checkbox combinations/notes; upload mode hides them; rerun restores choices for images/full; desktop/mobile pass; no AI jobs submitted.')
} finally {
 closing = true
 await context?.unrouteAll({ behavior: 'ignoreErrors' })
 await browser?.close()
 await prisma.workspace.delete({ where: { id: workspace.id } })
 await prisma.user.delete({ where: { id: user.id } })
 await prisma.$disconnect()
}
