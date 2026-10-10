require('dotenv').config({ path: '.env', quiet: true })
const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const { chromium } = require('/tmp/webtummy-layout-preview/node_modules/playwright')
const { prisma } = require('@awb/database')
async function main() {
  const fixture = JSON.parse(await fs.readFile('/home/ubuntu/webtummy-hosting-test-account.json', 'utf8'))
  const base = 'https://webtummy.com'
  const candidate = process.env.TEST_LINK_UI_BASE || 'http://127.0.0.1:3002'
  const project = await prisma.project.findUniqueOrThrow({ where: { id: fixture.projectId } })
  const browser = await chromium.launch({ headless: true, executablePath: '/home/ubuntu/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome', args: ['--no-sandbox'] })
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, permissions: ['clipboard-read', 'clipboard-write'] })
  await context.route('https://webtummy.com/**', async route => {
    const response = await route.fetch({ url: route.request().url().replace(base, candidate), headers: { ...route.request().headers(), host: 'webtummy.com', 'x-forwarded-host': 'webtummy.com', 'x-forwarded-proto': 'https' }, maxRedirects: 0 })
    await route.fulfill({ response })
  })
  try {
    const page = await context.newPage()
    const errors = []
    const posts = []
    const failedAssets = []
    page.on('pageerror', error => errors.push(error.message))
    page.on('response', response => { if (response.request().method() === 'POST') posts.push({ status: response.status(), action: !!response.request().headers()['next-action'] }) })
    page.on('response', response => { if (response.status() >= 400) failedAssets.push({ status: response.status(), path: new URL(response.url()).pathname }) })
    await page.goto(base + '/dashboard')
    assert.ok(page.url().includes('/signin'))
    // Open directly so the test proxy also handles the sign-in document,
    // rather than letting an anonymous redirect load the live release.
    await page.goto(base + '/signin')
    await page.locator('#signin-email').fill(fixture.email)
    await page.locator('#signin-password').fill(fixture.password)
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: 'Sign in', exact: true }).click()
    try { await page.waitForURL(/\/dashboard/) }
    catch (error) { console.log(JSON.stringify({ url: page.url(), alerts: await page.locator('[role="alert"]').allTextContents(), errors, posts, failedAssets })); throw error }
    const card = page.locator('article.wt-site-card').filter({ has: page.getByRole('heading', { name: project.name, exact: true }) })
    await card.getByRole('button', { name: 'Test link', exact: true }).click()
    const modal = page.getByRole('dialog', { name: 'Test link', exact: true })
    await modal.waitFor()
    const expected = `https://test-${fixture.projectId}.webtummy.com`
    assert.equal(await modal.getByLabel('Shareable link').inputValue(), expected)
    await modal.getByRole('button', { name: 'Copy link', exact: true }).click()
    await modal.getByRole('button', { name: 'Copied!', exact: true }).waitFor()
    assert.equal(await page.evaluate(() => navigator.clipboard.readText()), expected)
    await fs.mkdir('/home/ubuntu/webtummy-test-link-tests', { recursive: true })
    await page.screenshot({ path: '/home/ubuntu/webtummy-test-link-tests/dashboard-popup-desktop.png', fullPage: true })
    await page.setViewportSize({ width: 390, height: 844 })
    const bounds = await modal.boundingBox()
    assert.ok(bounds.width <= 390 && bounds.x >= 0)
    await page.screenshot({ path: '/home/ubuntu/webtummy-test-link-tests/dashboard-popup-mobile.png', fullPage: true })
    let action
    page.on('request', request => { if (request.method() === 'POST' && request.headers()['next-action']) action = { headers: request.headers(), body: request.postData() } })
    await modal.getByRole('button', { name: 'Update test link', exact: true }).click()
    await modal.getByText('Your test link is ready to share.', { exact: true }).waitFor({ timeout: 120000 })
    assert.ok(action)
    await modal.getByRole('button', { name: 'Close test link' }).click()
    await page.goto(base + `/projects/${fixture.projectId}/editor`)
    assert.equal(await page.getByRole('link', { name: 'Share test URL', exact: true }).count(), 0)
    await page.goto(base + `/projects/${fixture.projectId}/publishing`)
    assert.equal(await page.getByRole('button', { name: /Create test URL|Update test URL/ }).count(), 0)
    const cookie = (await context.cookies(base)).map(value => `${value.name}=${value.value}`).join('; ')
    const releases = await prisma.publishRelease.count({ where: { projectId: fixture.projectId } })
    await prisma.workspaceMember.updateMany({ where: { userId: fixture.userId, workspaceId: fixture.workspaceId }, data: { role: 'VIEWER' } })
    await page.goto(base + '/dashboard')
    assert.equal(await page.getByRole('button', { name: 'Test link', exact: true }).count(), 0)
    await page.request.post(candidate + '/dashboard', { headers: { 'content-type': action.headers['content-type'], 'next-action': action.headers['next-action'], origin: base, host: 'webtummy.com', 'x-forwarded-host': 'webtummy.com', 'x-forwarded-proto': 'https', cookie }, data: action.body })
    assert.equal(await prisma.publishRelease.count({ where: { projectId: fixture.projectId } }), releases)
    assert.deepEqual(errors, [])
    console.log('Passed dashboard popup, clipboard copy, mobile layout, update deployment, removal of old controls, and viewer action rejection.')
  } finally {
    await prisma.workspaceMember.updateMany({ where: { userId: fixture.userId, workspaceId: fixture.workspaceId }, data: { role: 'OWNER' } })
    await browser.close()
  }
}
main().finally(() => prisma.$disconnect()).catch(error => { console.error(error); process.exitCode = 1 })
