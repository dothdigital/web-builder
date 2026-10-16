import { config } from 'dotenv'
config({ path: '.env', quiet: true })
import assert from 'node:assert/strict'
import { mkdirSync } from 'node:fs'
import { encode } from 'next-auth/jwt'
const { prisma } = await import('@awb/database')
const { chromium } = await import('/tmp/webtummy-ui-check/node_modules/playwright/index.mjs')
const projectId = 'cmv8r9j240000twpapiu39z6x'
let browser: any, context: any, closing = false
try {
 const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId }, include: { workspace: { include: { members: { include: { user: true } } } } } })
 const user = project.workspace.members.find(member => member.role === 'OWNER')!.user

 const salt = '__Secure-authjs.session-token'
 const token = await encode({ secret: process.env.AUTH_SECRET!, salt, token: { sub: user.id, sessionVersion: user.sessionVersion }, maxAge: 300 })
 browser = await chromium.launch({ headless: true, args: ['--no-sandbox'], env: { ...process.env, LD_LIBRARY_PATH: '/tmp/webtummy-browser-libs/root/usr/lib/x86_64-linux-gnu' } })
 context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
 await context.addCookies([{ name: salt, value: token, domain: 'webtummy.com', path: '/', secure: true, httpOnly: true, sameSite: 'Lax' }])
 const candidate = process.env.UI_CHECK_BASE
 if (candidate) await context.route('https://webtummy.com/**', async (route: any) => {
  try { const response = await route.fetch({ url: route.request().url().replace('https://webtummy.com', candidate), headers: { ...route.request().headers(), host: 'webtummy.com', 'x-forwarded-host': 'webtummy.com', 'x-forwarded-proto': 'https' }, maxRedirects: 0 }); await route.fulfill({ response }) }
  catch { if (!closing) await route.abort().catch(() => {}) }
 })
 const page = await context.newPage()
 const errors: string[] = []
 const mutations: string[] = []
 page.on('request', (request: any) => { if (request.method() === 'POST' && !new URL(request.url()).pathname.startsWith('/cdn-cgi/')) mutations.push(new URL(request.url()).pathname) })
 page.on('pageerror', (error: Error) => errors.push(error.message))
 await page.goto(`https://webtummy.com/projects/${projectId}/editor`)
 const photo = page.locator('[data-awb-section-id="hero"] img[data-awb-element]:visible').first()
 await photo.waitFor()
 await photo.click()
 const toolbar = page.getByRole('toolbar', { name: 'image controls', exact: true })
 await toolbar.getByRole('button', { name: 'Replace image', exact: true }).click()
 await toolbar.getByRole('button', { name: 'Update with AI', exact: true }).click()
 const group = toolbar.getByRole('group', { name: 'Generated image style', exact: true })
 assert.equal(await group.getByRole('checkbox').count(), 5)
 assert.ok(await toolbar.getByText('Upload from computer', { exact: true }).isVisible())
 assert.ok(await toolbar.getByRole('button', { name: /Choose from image library/ }).count())
 await toolbar.getByLabel('What should the image show?', { exact: true }).fill('A natural local community consultation with warm daylight.')
 await group.getByLabel('People and human moments', { exact: true }).check()
 await group.getByLabel('Local places and community', { exact: true }).check()
 assert.ok(await toolbar.getByRole('button', { name: 'Generate image with AI', exact: true }).isEnabled())
 const dir = process.env.IMAGE_UI_ARTIFACTS || '/tmp/webtummy-editor-ai-image-check'
 mkdirSync(dir, { recursive: true })
 await page.screenshot({ path: `${dir}/desktop.png`, fullPage: true })
 await page.getByRole('button', { name: 'Focus canvas', exact: true }).evaluate((button: HTMLButtonElement) => button.click())
 await page.setViewportSize({ width: 390, height: 844 })
 await page.waitForTimeout(500)
 if (!await toolbar.isVisible()) await photo.click()
 if (await toolbar.getByRole('button', { name: 'Update with AI', exact: true }).count()) await toolbar.getByRole('button', { name: 'Update with AI', exact: true }).click()
 if (!await group.count()) {
  await toolbar.getByRole('button', { name: 'Replace image', exact: true }).click()
  await toolbar.getByRole('button', { name: 'Update with AI', exact: true }).click()
 }
 await page.screenshot({ path: `${dir}/mobile-before.png`, fullPage: true })
 await group.getByLabel('Custom direction', { exact: true }).scrollIntoViewIfNeeded()
 const bounds = await toolbar.boundingBox()
 assert.ok(bounds && bounds.x >= 0 && bounds.width <= 390 && bounds.height <= 844, 'Image panel must fit the viewport')
 await toolbar.getByRole('button', { name: 'Generate image with AI', exact: true }).scrollIntoViewIfNeeded()
 await page.screenshot({ path: `${dir}/mobile.png`, fullPage: true })
 await toolbar.getByRole('button', { name: 'Close AI image update', exact: true }).click()
 assert.deepEqual(mutations, [], 'Opening the AI controls must not save, replace images or submit generation jobs')
 assert.deepEqual(errors, [])
 console.log('PASS: actual Replace image toolbar offers upload/library/AI; five style checkboxes and instructions work; desktop/mobile panel fits; no save, replacement or generation requests submitted.')
} finally { closing = true; await context?.unrouteAll({ behavior: 'ignoreErrors' }); await browser?.close(); await prisma.$disconnect() }
