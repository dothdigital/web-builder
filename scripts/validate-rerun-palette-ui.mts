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
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined
  try {
    browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'], env: { ...process.env, LD_LIBRARY_PATH: '/tmp/webtummy-browser-libs/root/usr/lib/x86_64-linux-gnu' } })
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, permissions: ['microphone'] })
    await context.addInitScript(() => { Object.defineProperty(window, 'RTCPeerConnection', { value: undefined, configurable: true }) })
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
    await page.getByRole('button', { name: 'Rerun with AI', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'Rerun with AI' })
    await dialog.waitFor()
    await dialog.getByRole('radio', { name: /Full website/ }).check()
    await dialog.getByRole('textbox', { name: 'What should AI do?' }).fill('Rebuild with the selected colours.')
    const secondPalette = { ...defaultTokens.palette, primary: '#123456' }
    await context.route('https://webtummy.com/api/assets', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ asset: { id: 'test-logo' }, colors: [{ hex: '#123456' }], suggestions: [{ id: 'first', label: 'Logo colours', rationale: 'Recommended from your logo', tokens: defaultTokens }, { id: 'second', label: 'Alternative colours', rationale: 'An alternative', tokens: { ...defaultTokens, palette: secondPalette } }] }) }))
    await dialog.locator('input[type="file"]').first().setInputFiles({ name: 'logo.png', mimeType: 'image/png', buffer: Buffer.from('fixture') })
    await dialog.getByText('Choose your website colours', { exact: true }).waitFor()
    assert.ok(await dialog.getByRole('radio', { name: /Logo colours/ }).isChecked())
    assert.equal(await dialog.getByRole('button', { name: /Let AI choose|Apply colours/ }).count(), 0)
    let expectedPalette: typeof defaultTokens.palette | undefined
    let submissions = 0
    await context.route('https://webtummy.com/dashboard', async route => {
      if (route.request().method() !== 'POST') return route.fallback()
      const body = route.request().postData() ?? ''
      if (expectedPalette) {
        assert.ok(body.includes('"palette":'), 'Selection is included directly in submission')
        assert.ok(body.includes(expectedPalette.primary), 'Latest selected palette is submitted')
      } else assert.ok(!body.includes('"palette":'), 'Keep current colours sends no replacement palette')
      submissions++
      await route.abort()
    })
    await dialog.getByRole('radio', { name: /Alternative colours/ }).check()
    expectedPalette = secondPalette
    await dialog.getByRole('button', { name: 'Rebuild website', exact: true }).click()
    await page.waitForFunction(() => document.querySelector('dialog button[type="submit"]')?.textContent === 'Rebuild website')
    assert.equal(submissions, 1)
    await dialog.getByRole('radio', { name: 'Keep current colours', exact: true }).check()
    expectedPalette = undefined
    await dialog.getByRole('button', { name: 'Rebuild website', exact: true }).click()
    await page.waitForFunction(() => document.querySelector('dialog button[type="submit"]')?.textContent === 'Rebuild website')
    assert.equal(submissions, 2)
    await dialog.getByRole('radio', { name: /Upload logo or photos/ }).check()
    await dialog.getByRole('radio', { name: /Logo colours/ }).check()
    expectedPalette = defaultTokens.palette
    await dialog.getByRole('button', { name: 'Apply uploads', exact: true }).click()
    await page.waitForFunction(() => document.querySelector('dialog button[type="submit"]')?.textContent === 'Apply uploads')
    assert.equal(submissions, 3)
    await page.setViewportSize({ width: 390, height: 844 })
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1))
    console.log('PASS: recommended default, latest selection submitted by bottom button, keep-current option, uploads-only submission, and mobile layout.')
    assert.deepEqual(errors, [], 'No browser runtime errors')
  } finally {
    await browser?.close()
    await prisma.workspace.delete({ where: { id: workspace.id } })
    await prisma.user.delete({ where: { id: user.id } })
    await prisma.$disconnect()
  }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
