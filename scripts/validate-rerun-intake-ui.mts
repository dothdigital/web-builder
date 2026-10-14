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
    // Keep this check focused on the recorded fallback; live streaming has its own browser check.
    await context.addInitScript(() => { Object.defineProperty(window, 'RTCPeerConnection', { value: undefined, configurable: true }) })
    const candidate = process.env.UI_CHECK_BASE || 'http://127.0.0.1:3002'
    await context.route('https://webtummy.com/**', async route => {
      const response = await route.fetch({ url: route.request().url().replace('https://webtummy.com', candidate), headers: { ...route.request().headers(), host: 'webtummy.com', 'x-forwarded-host': 'webtummy.com', 'x-forwarded-proto': 'https' }, maxRedirects: 0 })
      await route.fulfill({ response })
    })
    let recordings = 0
    await context.route('https://webtummy.com/api/intake/transcribe', async route => {
      assert.equal(route.request().method(), 'POST')
      assert.ok((route.request().postDataBuffer()?.length ?? 0) > 100)
      recordings++
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ text: 'We renovate kitchens and bathrooms in London.' }) })
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
    assert.equal(await dialog.getByRole('radio').count(), 4)
    await dialog.getByRole('radio', { name: /Content only/ }).check()
    await dialog.getByRole('textbox', { name: 'What should AI do?' }).fill('Make the copy shorter.')
    await dialog.getByRole('radio', { name: /Images only/ }).check()
    await dialog.getByRole('textbox', { name: 'What should AI do?' }).fill('Use warm office photos.')
    await dialog.getByRole('radio', { name: /Upload logo or photos/ }).check()
    assert.ok(await dialog.getByRole('button', { name: 'Apply uploads', exact: true }).isDisabled())
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
    assert.equal(await prisma.contentJob.count({ where: { projectId: project.id } }), 0, 'Opening and cancelling does not submit a job')
    await page.getByRole('link', { name: '+ New website', exact: true }).click()
    await page.waitForURL(/\/onboarding/)
    await page.getByLabel('Business name', { exact: true }).fill('UI verification business')
    const textarea = page.locator('textarea').first()
    await textarea.fill('We provide reliable renovation services.')
    const record = page.getByRole('button', { name: 'Record voice for What does the business do?', exact: true })
    await record.click()
    await page.getByRole('button', { name: 'Stop recording for What does the business do?', exact: true }).waitFor()
    await page.waitForTimeout(700)
    await page.getByRole('button', { name: 'Stop recording for What does the business do?', exact: true }).click()
    await page.getByRole('textbox', { name: 'Review and edit transcript', exact: true }).waitFor()
    await page.getByRole('textbox', { name: 'Review and edit transcript', exact: true }).fill('We renovate kitchens in London.')
    await page.getByRole('button', { name: 'Use this text', exact: true }).click()
    assert.equal(await textarea.inputValue(), 'We provide reliable renovation services.\n\nWe renovate kitchens in London.')
    assert.equal(recordings, 1)
    await page.getByRole('button', { name: 'Continue', exact: true }).click()
    await page.getByText('Choose your website colours', { exact: true }).waitFor()
    for (const label of ['Ocean blue', 'Forest green', 'Plum and rose', 'Warm terracotta', 'Classic neutral']) assert.ok(await page.getByRole('button', { name: new RegExp(label) }).isVisible())
    await page.getByRole('button', { name: /Ocean blue/ }).click()
    assert.equal(await page.getByRole('button', { name: /Ocean blue/ }).getAttribute('aria-pressed'), 'true')
    await page.getByText('Fine-tune any colour', { exact: true }).waitFor()
    await page.getByRole('button', { name: 'Continue', exact: true }).click()
    const uploadPhotos = page.getByRole('button', { name: 'Upload photos', exact: true })
    await uploadPhotos.waitFor()
    const chooserPromise = page.waitForEvent('filechooser')
    await uploadPhotos.click()
    const chooser = await chooserPromise
    assert.equal(chooser.isMultiple(), true)
    await chooser.setFiles([])
    assert.equal(await page.locator('input[type="file"]:visible').count(), 0, 'Native No file chosen control is hidden')
    await page.setViewportSize({ width: 390, height: 844 })
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'Intake has no horizontal overflow on mobile')
    await page.screenshot({ path: '/tmp/webtummy-intake-palettes-mobile.png', fullPage: true })
    assert.deepEqual(errors, [], 'No browser runtime errors')
    console.log('PASS: authenticated desktop/mobile intake, record/stop/transcribe/review/use flow with fake microphone and transcription, all five no-logo palettes, rerun scope dialog and cancellation without jobs.')
  } finally {
    await browser?.close()
    await prisma.workspace.delete({ where: { id: workspace.id } })
    await prisma.user.delete({ where: { id: user.id } })
    await prisma.$disconnect()
  }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
