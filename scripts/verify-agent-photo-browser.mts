import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
const { chromium } = await import('/tmp/webtummy-ui-check/node_modules/playwright/index.mjs')
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'], env: { ...process.env, LD_LIBRARY_PATH: '/tmp/webtummy-browser-libs/root/usr/lib/x86_64-linux-gnu' } })
try {
 const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
 await context.addCookies([JSON.parse(await readFile('/tmp/secure-path-browser-auth.json', 'utf8'))])
 const page = await context.newPage()
 for (const route of ['', '/about']) {
  await page.goto(`https://webtummy.com/preview/cmv8r9j240000twpapiu39z6x${route}`)
  const counts = await page.locator('img').evaluateAll(images => ({ all: images.filter(image => image.src.includes('whatsapp-image-2026-10-13')).length, visible: images.filter(image => image.src.includes('whatsapp-image-2026-10-13') && image.getBoundingClientRect().width > 0 && image.getBoundingClientRect().height > 0).length }))
  assert.deepEqual(counts, { all: 1, visible: 1 })
  await page.screenshot({ path: `/tmp/agent-photo-fixed-${route ? 'about' : 'home'}.png`, fullPage: true })
  console.log(`${route || '/'}: browser confirms exactly one visible agent photograph`)
 }
} finally { await browser.close() }
