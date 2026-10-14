require('dotenv').config({ path: '.env', quiet: true })
const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const { chromium } = require('/tmp/webtummy-layout-preview/node_modules/playwright')
async function main() {
  const fixture = JSON.parse(await fs.readFile('/home/ubuntu/webtummy-hosting-test-account.json', 'utf8'))
  const base = 'https://webtummy.com'
  const candidate = process.env.NOTICE_UI_BASE || 'http://127.0.0.1:3003'
  const browser = await chromium.launch({ headless: true, executablePath: '/home/ubuntu/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome', args: ['--no-sandbox'] })
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
    let jobs = [{ id: 'notice-browser-fixture', projectId: fixture.projectId, title: 'Website: Test website', kind: 'WEBSITE', status: 'READY' }]
    await context.route(base + '/**', async route => {
      if (new URL(route.request().url()).pathname === '/api/content-jobs') return route.fulfill({ json: { jobs } })
      const response = await route.fetch({ url: route.request().url().replace(base, candidate), headers: { ...route.request().headers(), host: 'webtummy.com', 'x-forwarded-host': 'webtummy.com', 'x-forwarded-proto': 'https' }, maxRedirects: 0 })
      await route.fulfill({ response })
    })
    const page = await context.newPage()
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.goto(base + '/signin')
    await page.locator('#signin-email').fill(fixture.email)
    await page.locator('#signin-password').fill(fixture.password)
    await page.getByRole('button', { name: 'Sign in', exact: true }).click()
    await page.waitForURL(/\/dashboard/)
    for (const editor of [false, true]) {
      if (editor) await page.goto(base + `/projects/${fixture.projectId}/editor`)
      const notice = page.locator('details').filter({ hasText: 'Website: Test website' })
      await notice.getByText('Website draft saved — ready in Preview', { exact: true }).waitFor()
      assert.ok((await notice.innerText()).includes('Completed website drafts are already saved.'))
      assert.ok(!(await notice.innerText()).includes('not yet added to Preview'))
      assert.ok(!(await notice.innerText()).includes('Open generated draft in new tab'))
      assert.equal(await notice.getByRole('link', { name: 'Edit website', exact: true }).count(), editor ? 0 : 1)
      const popupPromise = context.waitForEvent('page')
      await notice.getByRole('link', { name: 'Preview website', exact: true }).click()
      const popup = await popupPromise
      await popup.waitForURL(base + `/preview/${fixture.projectId}`)
      await popup.locator('main').waitFor()
      assert.ok((await popup.locator('main').innerText()).length > 0)
      await popup.close()
      if (!editor) {
        await notice.getByRole('link', { name: 'Edit website', exact: true }).click()
        await page.waitForURL(base + `/projects/${fixture.projectId}/editor`)
        await page.getByRole('button', { name: '+ Blog / Page', exact: true }).waitFor()
      }
    }
    jobs = [jobs[0], { id: 'content-browser-fixture', projectId: fixture.projectId, title: 'Blog: New article', kind: 'CREATE', status: 'READY' }]
    await page.reload()
    const mixed = page.locator('details').filter({ hasText: 'Blog: New article' })
    await mixed.getByRole('button', { name: 'Review', exact: true }).waitFor()
    assert.ok((await mixed.innerText()).includes('add the generated content to your editor draft'))
    await page.setViewportSize({ width: 390, height: 844 })
    assert.ok(await mixed.getByRole('link', { name: 'Preview website', exact: true }).isVisible())
    assert.deepEqual(errors, [])
    console.log('PASS: dashboard and editor website actions open real Preview; dashboard Edit opens editor; saved status and mixed content instructions are correct; mobile actions remain visible.')
  } finally { await browser.close() }
}
main().catch(error => { console.error(error.message); process.exitCode = 1 })
