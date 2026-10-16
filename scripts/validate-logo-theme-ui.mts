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
  model.pages[0]!.sections[0]!.props.sectionBackgroundColor = '#12ab34'
  await prisma.websiteVersion.updateMany({ where: { projectId: project.id }, data: { model } })
  const { paletteAlternatives } = await import('@awb/ai')
  const suggestions = paletteAlternatives(defaultTokens, ['#01481d', '#f8b900'])
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined
  try {
    browser = await chromium.launch({ headless: true, args: ['--no-sandbox'], env: { ...process.env, LD_LIBRARY_PATH: '/tmp/webtummy-browser-libs/root/usr/lib/x86_64-linux-gnu' } })
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
    const candidate = process.env.UI_CHECK_BASE || 'http://127.0.0.1:3002'
    await context.route('https://webtummy.com/**', async route => {
      const response = await route.fetch({ url: route.request().url().replace('https://webtummy.com', candidate), headers: { ...route.request().headers(), host: 'webtummy.com', 'x-forwarded-host': 'webtummy.com', 'x-forwarded-proto': 'https' }, maxRedirects: 0 })
      await route.fulfill({ response })
    })
    await context.route('**/api/assets', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ asset: { id: 'test-logo', url: '/test-logo.png' }, colors: [{ hex: '#01481d' }, { hex: '#f8b900' }], suggestions }) }))
    await context.route('**/editor-image?**', route => route.fulfill({ status: 200, contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a3ioAAAAASUVORK5CYII=', 'base64') }))
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
    await dialog.getByRole('radio', { name: /Upload logo or photos/ }).check()
    const file = { name: 'logo.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10" fill="#01481d"/></svg>') }
    await dialog.locator('input[type=file]').first().setInputFiles(file)
    await dialog.getByText('Detected logo colours', { exact: true }).waitFor()
    await dialog.getByText('#f8b900', { exact: true }).waitFor()
    assert.ok(await dialog.getByRole('radio', { name: /Recommended/ }).isChecked())
    await dialog.getByRole('button', { name: 'Apply colours to entire site', exact: true }).click()
    await dialog.getByRole('button', { name: 'Revert to previous theme colours', exact: true }).click()
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
    assert.equal(await prisma.contentJob.count({ where: { projectId: project.id } }), 0)
    await page.goto(`https://webtummy.com/projects/${project.id}/editor`)
    await page.getByRole('button', { name: 'theme', exact: true }).click()
    await page.getByLabel('Website colour #12ab34 hex code', { exact: true }).waitFor()
    await page.getByLabel('Upload website logo', { exact: true }).setInputFiles(file)
    await page.getByText('Detected logo colours', { exact: true }).waitFor()
    await page.getByRole('button', { name: 'Apply colours to entire site', exact: true }).click()
    assert.equal((await page.getByLabel('primary hex code', { exact: true }).inputValue()).toLowerCase(), '#01481d')
    assert.equal((await page.getByLabel('accent hex code', { exact: true }).inputValue()).toLowerCase(), '#f8b900')
    await page.getByRole('button', { name: 'Revert theme colours', exact: true }).click()
    assert.equal((await page.getByLabel('primary hex code', { exact: true }).inputValue()).toLowerCase(), defaultTokens.palette.primary.toLowerCase())
    await page.getByLabel('Website colour #12ab34 hex code', { exact: true }).waitFor()
    await page.screenshot({ path: '/tmp/webtummy-logo-theme-desktop.png', fullPage: true })
    assert.deepEqual(errors, [])
    console.log('PASS: browser logo suggestions, recommended selection, Apply/Revert in rerun and Theme, custom site colours; no external AI jobs or customer edits.')
  } finally {
    await browser?.close()
    await prisma.workspace.delete({ where: { id: workspace.id } })
    await prisma.user.delete({ where: { id: user.id } })
    await prisma.$disconnect()
  }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
