import 'dotenv/config'
import assert from 'node:assert/strict'
import React from 'react'
import JSZip from 'jszip'
import { prisma } from '@awb/database'
import { websiteModelSchema } from '@awb/website-model'
import { buildStaticExport } from '../apps/web/src/lib/static-export'
import { encryptRecaptchaSecret, decryptRecaptchaSecret, verifyRecaptcha } from '../apps/web/src/lib/recaptcha'
Object.assign(globalThis, { React })
async function main() {
  const version = await prisma.websiteVersion.findFirstOrThrow({ orderBy: { createdAt: 'desc' } })
  const stripImages = (value: unknown): unknown => Array.isArray(value) ? value.map(stripImages) : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, /image.*url|logo.*url/i.test(key) ? '' : stripImages(entry)])) : typeof value === 'string' && /\.(png|jpe?g|webp|avif|gif|svg)(\?|$)/i.test(value) ? '' : value
  const model = websiteModelSchema.parse(stripImages(version.model))
  model.analyticsSettings.ga4MeasurementId = 'G-TEST123'
  model.customScripts = { head: '<script>window.globalHead=true;</script>', bodyEnd: '<script>window.globalEnd=true;</script>' }
  model.pages[0]!.customScripts = { head: '<script>window.pageOnly=true;</script>', bodyEnd: '' }
  const zip = await JSZip.loadAsync(await buildStaticExport(model, { siteUrl: 'https://example.com', forms: { projectId: 'test-project', action: 'https://builder.example/api/leads', recaptchaSiteKey: 'test-public-key' } }))
  const html = await Promise.all(Object.values(zip.files).filter((file) => file.name.endsWith('.html')).map((file) => file.async('string')))
  for (const page of html) {
    assert.ok(page.includes('gtag/js?id=G-TEST123'))
    assert.ok(page.indexOf('window.globalHead=true') < page.indexOf('</head>'))
    assert.ok(page.indexOf('window.globalEnd=true') < page.indexOf('</body>'))
  }
  assert.equal(html.filter((page) => page.includes('window.pageOnly=true')).length, 1)
  assert.ok(html.some((page) => page.includes('name="projectId" value="test-project"')))
  assert.ok(html.some((page) => page.includes('data-sitekey="test-public-key"')))
  const previousKey = process.env.AUTH_SECRET
  process.env.AUTH_SECRET = 'integration-test-only-key'
  try {
    const encrypted = encryptRecaptchaSecret('private-test-secret')
    assert.ok(!encrypted.includes('private-test-secret'))
    assert.equal(decryptRecaptchaSecret(encrypted), 'private-test-secret')
  } finally { if (previousKey === undefined) delete process.env.AUTH_SECRET; else process.env.AUTH_SECRET = previousKey }
  const originalFetch = globalThis.fetch
  try {
    globalThis.fetch = async () => Response.json({ success: true, hostname: 'example.com' })
    assert.equal(await verifyRecaptcha('secret', 'token', ['example.com']), true)
    assert.equal(await verifyRecaptcha('secret', 'token', ['other.com']), false)
    assert.equal(await verifyRecaptcha('secret', '', ['example.com']), false)
    globalThis.fetch = async () => { throw new Error('offline') }
    assert.equal(await verifyRecaptcha('secret', 'token', ['example.com']), false)
  } finally { globalThis.fetch = originalFetch }
  console.log('PASS: GA4, global/page script placement, form wiring, secret encryption and CAPTCHA rejection checks. No Google requests sent.')
}
main().finally(() => prisma.$disconnect())
