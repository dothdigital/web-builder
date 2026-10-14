// Live provider smoke test with a synthetic speech fixture; creates no websites.
// node --env-file=.env --import tsx scripts/validate-live-intake-browser.cjs
const assert = require('node:assert/strict')
const fs = require('node:fs')
async function main() {
  const { prisma } = await import('@awb/database')
  const { encode } = await import('next-auth/jwt')
  const { chromium } = await import('/tmp/webtummy-ui-check/node_modules/playwright/index.mjs')
  const fixture = process.env.INTAKE_SPEECH_FIXTURE || '/tmp/webtummy-speech-check/intake.wav'
  assert.ok(fs.existsSync(fixture), 'Provide a synthetic speech WAV with INTAKE_SPEECH_FIXTURE')
  let browser
  try {
    const user = await prisma.user.findFirstOrThrow({ where: { isPlatformAdmin: true, suspendedAt: null } })
    browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', `--use-file-for-fake-audio-capture=${fixture}`], env: { ...process.env, LD_LIBRARY_PATH: '/tmp/webtummy-browser-libs/root/usr/lib/x86_64-linux-gnu' } })
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, permissions: ['microphone'] })
    const salt = '__Secure-authjs.session-token'
    const token = await encode({ secret: process.env.AUTH_SECRET, salt, token: { sub: user.id, sessionVersion: user.sessionVersion }, maxAge: 120 })
    await context.addCookies([{ name: salt, value: token, domain: 'webtummy.com', path: '/', secure: true, httpOnly: true, sameSite: 'Lax' }])
    const page = await context.newPage()
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.goto('https://webtummy.com/onboarding')
    await page.getByRole('button', { name: 'Record voice for What does the business do?', exact: true }).waitFor()
    assert.equal(await page.getByRole('button', { name: /^Record voice for/ }).count(), 1, 'Voice must appear only on business description')
    await page.getByRole('button', { name: 'Record voice for What does the business do?', exact: true }).click()
    const stop = page.getByRole('button', { name: 'Stop recording for What does the business do?', exact: true })
    await stop.waitFor({ timeout: 35000 })
    const live = page.getByRole('textbox', { name: 'Live transcript', exact: true })
    await page.waitForFunction(() => [...document.querySelectorAll('textarea')].some(node => node.readOnly && node.value.trim()), null, { timeout: 35000 })
    assert.ok((await live.inputValue()).trim(), 'Real provider text must appear before Stop')
    assert.ok(await stop.isVisible())
    await stop.click()
    const review = page.getByRole('textbox', { name: 'Review and edit transcript', exact: true })
    await review.waitFor()
    const use = page.getByRole('button', { name: 'Use this text', exact: true })
    await use.waitFor()
    await page.waitForFunction(() => [...document.querySelectorAll('button')].some(node => node.textContent === 'Use this text' && !node.disabled), null, { timeout: 16000 })
    assert.equal(await review.getAttribute('readonly'), null)
    const finalText = await review.inputValue()
    assert.ok(finalText.trim())
    assert.deepEqual((await page.getByRole('alert').allTextContents()).filter(text => text.trim()), [], 'Final commit must complete without timeout or provider errors')
    await use.click()
    assert.equal(await page.getByRole('textbox', { name: /^What does the business do\?/ }).inputValue(), finalText)
    await page.setViewportSize({ width: 390, height: 844 })
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1))
    assert.deepEqual(errors, [])
    console.log('PASS: live public intake, description-only voice, real speech deltas before Stop, final transcript, Use this text, and mobile layout.')
  } finally { await browser?.close(); await prisma.$disconnect() }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
