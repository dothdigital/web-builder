import { config } from 'dotenv'
config({ path: '.env', quiet: true })
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'

async function main() {
  const { prisma } = await import('@awb/database')
  const { hashPassword } = await import('../apps/web/src/lib/account-security')
  const { defaultTokens, getComponent, listComponents } = await import('@awb/component-registry')
  const { websiteModelSchema } = await import('@awb/website-model')
  const { StubAiProvider } = await import('@awb/ai')
  const { chromium } = await import('/tmp/webtummy-ui-check/node_modules/playwright/index.mjs')
  const id = randomUUID()
  const email = `intake-ui-${id}@example.invalid`
  const password = randomUUID() + 'Aa1!'
  const workspace = await prisma.workspace.create({ data: { name: 'Temporary intake UI verification', slug: `intake-ui-${id}`, billingExempt: true, billingExemptionReason: 'Temporary automated verification' } })
  const user = await prisma.user.create({ data: { email, name: 'UI verification', passwordHash: await hashPassword(password), emailVerified: new Date(), memberships: { create: { workspaceId: workspace.id, role: 'OWNER' } } } })
  const project = await prisma.project.create({ data: { workspaceId: workspace.id, name: 'UI verification website', slug: 'ui-verification', previewHost: `ui-${id}.invalid` } })
  // All fixture copy is synthetic. No external AI calls or publishing.
  const brief = { businessName: 'UI verification', description: 'A temporary renovation business for interface checks.', services: [], goals: [], tonePreferences: [], answers: {}, hasLogo: false, logoColors: [], uploadedImageUrls: [], testimonials: [] }
  const stub = new StubAiProvider({ seed: 'ui-verification' })
  const analysis = (await stub.analyzeBrief(brief)).data
  const dna = (await stub.proposeDesignDirections(brief, analysis)).data.options[0]!.dna
  const header = listComponents().find(component => component.family === 'HEADER')!
  const footer = listComponents().find(component => component.family === 'FOOTER')!
  const hero = getComponent('HeroEditorial')!
  const model = websiteModelSchema.parse({ schemaVersion: '1.0.0', site: { name: brief.businessName, previewHost: project.previewHost }, businessProfileRef: project.id, designDna: dna, tokens: defaultTokens, navigation: { primaryMenu: [] }, globalComponents: { header: { componentId: header.componentId, props: header.fixture }, footer: { componentId: footer.componentId, props: footer.fixture } }, pages: [{ id: 'home', path: '/', title: 'Home', h1: 'UI verification', seo: { title: 'UI verification', description: brief.description }, sections: [{ id: 'hero', componentId: hero.componentId, props: { ...hero.fixture as object, heading: 'UI verification', imageUrl: '' } }] }] })
  await prisma.websiteVersion.create({ data: { projectId: project.id, version: 1, kind: 'DRAFT', schemaVersion: '1.0.0', model } })
  const imageUrl = 'data:image/svg+xml;base64,' + Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="600"><rect width="400" height="600" fill="#123456"/></svg>').toString('base64')
  model.pages[0]!.sections[0]!.props.imageUrl = imageUrl
  const story = getComponent('AboutSplitOverlap')!
  model.pages[0]!.sections.push({ id: 'empty-story', componentId: story.componentId, componentVersion: story.version, hidden: false, props: story.propsSchema.parse({ ...story.fixture, imageUrl: '' }) }, { id: 'missing-story', componentId: story.componentId, componentVersion: story.version, hidden: false, props: story.propsSchema.parse(story.fixture) })
  model.pages.push({ ...structuredClone(model.pages[0]!), id: 'about', path: '/about', title: 'About' })
  await prisma.websiteVersion.updateMany({ where: { projectId: project.id }, data: { model } })
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined
  try {
    browser = await chromium.launch({ headless: true, args: ['--no-sandbox'], env: { ...process.env, LD_LIBRARY_PATH: '/tmp/webtummy-browser-libs/root/usr/lib/x86_64-linux-gnu' } })
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
    const candidate = process.env.UI_CHECK_BASE || 'http://127.0.0.1:3002'
    await context.route('https://webtummy.com/**', async route => {
      const response = await route.fetch({ url: route.request().url().replace('https://webtummy.com', candidate), headers: { ...route.request().headers(), host: 'webtummy.com', 'x-forwarded-host': 'webtummy.com', 'x-forwarded-proto': 'https' }, maxRedirects: 0 })
      await route.fulfill({ response })
    })
    const page = await context.newPage()
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    await page.goto('https://webtummy.com/signin')
    await page.locator('#signin-email').fill(email)
    await page.locator('#signin-password').fill(password)
    await page.getByRole('button', { name: 'Sign in', exact: true }).click()
    await page.waitForURL(/\/dashboard/)
    const count = () => page.locator('img').evaluateAll((images, url) => images.filter(image => image.getAttribute('src') === url).length, imageUrl)
    for (const route of ['', '/about']) {
      await page.goto(`https://webtummy.com/preview/${project.id}${route}`)
      assert.equal(await count(), 1, `Preview ${route || '/'} must not copy the portrait into empty/missing fields`)
    }
    await page.goto(`https://webtummy.com/projects/${project.id}/editor`)
    assert.equal(await count(), 1, 'Editor home')
    await page.getByRole('button', { name: /^Select page:/ }).first().click()
    await page.getByRole('button', { name: 'About /about', exact: true }).click()
    await page.waitForTimeout(100)
    assert.equal(await count(), 1, 'Editor About')
    assert.deepEqual(errors, [])
    console.log('PASS: authenticated Preview and editor render the portrait once per page; empty and omitted supporting image fields never inherit it.')
  } finally {
    await browser?.close()
    await prisma.workspace.delete({ where: { id: workspace.id } })
    await prisma.user.delete({ where: { id: user.id } })
    await prisma.$disconnect()
  }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
