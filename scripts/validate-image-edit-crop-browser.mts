import { config } from 'dotenv'
config({ path: '.env', quiet: true })
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { mkdir, writeFile, readFile, rm } from 'node:fs/promises'
import path from 'node:path'
import { encode } from 'next-auth/jwt'
import sharp from 'sharp'
import { websiteModelSchema } from '@awb/website-model'
import { getComponent, defaultTokens } from '@awb/component-registry'
import { localUploadRoot, getStorage, readPublicImage } from '@awb/shared'
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3'
const s3 = new S3Client({ region: process.env.S3_REGION || 'us-east-1', ...(process.env.S3_ENDPOINT ? { endpoint: process.env.S3_ENDPOINT, forcePathStyle: true } : {}), ...(process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY ? { credentials: { accessKeyId: process.env.S3_ACCESS_KEY_ID, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY } } : {}) })
const assetBytes = async (asset: { url: string; storageKey: string }) => asset.url.startsWith('/uploads/') ? readFile(path.join(localUploadRoot(), asset.storageKey)) : (await readPublicImage(await getStorage().readUrl(asset.storageKey))).bytes
const { prisma } = await import('@awb/database')
const { chromium } = await import('/tmp/webtummy-ui-check/node_modules/playwright/index.mjs')
const tag = 'image-edit-test-' + randomUUID()
const directory = path.join(localUploadRoot(), tag)
let workspace: any, user: any, project: any, browser: any, context: any, page: any, closing = false
try {
  workspace = await prisma.workspace.create({ data: { name: tag, slug: tag, billingExempt: true, billingExemptionReason: 'Isolated image editing browser verification' } })
  user = await prisma.user.create({ data: { email: tag + '@example.invalid', name: 'Image editor test', emailVerified: new Date(), memberships: { create: { workspaceId: workspace.id, role: 'OWNER' } } } })
  project = await prisma.project.create({ data: { workspaceId: workspace.id, name: tag, slug: tag, previewHost: tag + '.preview.local' } })
  await mkdir(directory, { recursive: true })
  const bytes = await sharp(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="400"><rect width="800" height="400" fill="#1565c0"/><rect width="400" height="400" fill="#d32f2f"/><circle cx="400" cy="200" r="80" fill="white"/></svg>')).png().toBuffer()
  await writeFile(path.join(directory, 'original.png'), bytes)
  const original = '/uploads/' + tag + '/original.png'
  await prisma.asset.create({ data: { workspaceId: workspace.id, projectId: project.id, kind: 'IMAGE', source: 'UPLOAD', url: original, storageKey: tag + '/original.png', mimeType: 'image/png', bytes: bytes.length } })
  const seed = await prisma.websiteVersion.findFirstOrThrow({ where: { kind: 'DRAFT' }, orderBy: { createdAt: 'asc' } })
  const model = websiteModelSchema.parse(seed.model)
  const header = getComponent('HeaderSplitUtility')!, footer = getComponent('FooterCompact')!, hero = getComponent('HeroSplitBooking')!
  model.site = { name: 'Image editing verification', previewHost: project.previewHost, locale: 'en' }
  model.businessProfileRef = project.id; model.tokens = structuredClone(defaultTokens); model.contact = { hours: [] }; model.socials = []; model.navigation = { primaryMenu: [] }; model.customScripts = undefined
  model.globalComponents = { header: { componentId: header.componentId, componentVersion: header.version, props: { ...header.fixture as object, logoText: 'Image editing test', logoImageUrl: original } }, footer: { componentId: footer.componentId, componentVersion: footer.version, props: { ...footer.fixture as object, businessName: 'Image editing test', logoImageUrl: original } } } as any
  model.pages = [{ id: 'home', path: '/', title: 'Image editing test', h1: 'Image editing test', pageType: 'CUSTOM', seo: { title: 'Image editing test', description: 'Temporary browser test', index: false }, sections: [{ id: 'hero', componentId: hero.componentId, componentVersion: hero.version, hidden: false, props: { ...hero.fixture as object, heading: 'Image editing test', imageUrl: original, imageAlt: 'Original test image', imageSizes: { '/imageUrl': { fit: 'contain' } } } }] }] as any
  await prisma.websiteVersion.create({ data: { projectId: project.id, version: 1, kind: 'DRAFT', schemaVersion: model.schemaVersion, model: JSON.parse(JSON.stringify(model)) } })
  const salt = '__Secure-authjs.session-token'
  const token = await encode({ secret: process.env.AUTH_SECRET!, salt, token: { sub: user.id, sessionVersion: user.sessionVersion }, maxAge: 1800 })
  browser = await chromium.launch({ headless: true, args: ['--no-sandbox'], env: { ...process.env, LD_LIBRARY_PATH: '/tmp/webtummy-browser-libs/root/usr/lib/x86_64-linux-gnu' } })
  context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  await context.addCookies([{ name: salt, value: token, domain: 'webtummy.com', path: '/', secure: true, httpOnly: true, sameSite: 'Lax' }])
  const candidate = process.env.UI_CHECK_BASE
  if (candidate) await context.route('https://webtummy.com/**', async (route: any) => { try { const response = await route.fetch({ url: route.request().url().replace('https://webtummy.com', candidate), headers: { ...route.request().headers(), host: 'webtummy.com', 'x-forwarded-host': 'webtummy.com', 'x-forwarded-proto': 'https' }, maxRedirects: 0 }); await route.fulfill({ response }) } catch { if (!closing) await route.abort().catch(() => {}) } })
  page = await context.newPage()
  page.setDefaultTimeout(30000)
  const errors: string[] = []; page.on('pageerror', (error: Error) => errors.push(error.message))
  await page.goto('https://webtummy.com/projects/' + project.id + '/editor')
  const photo = page.locator('[data-awb-section-id="hero"] img[data-awb-element="/imageUrl"]')
  const controls = page.getByRole('region', { name: 'Toolbar image controls', exact: true })
  const select = async () => { await photo.scrollIntoViewIfNeeded(); await photo.click(); await controls.waitFor() }
  await select()
  await controls.getByRole('button', { name: 'Crop', exact: true }).click()
  await page.getByRole('button', { name: 'Apply crop', exact: true }).waitFor({ state: 'visible' })
  await page.waitForFunction(() => !document.querySelector<HTMLButtonElement>('[aria-label="Crop controls"] button:last-of-type')?.disabled)
  assert.equal(await page.getByRole('dialog', { name: 'Crop image' }).count(), 0, 'Quick crop stays on the website canvas')
  await page.getByRole('button', { name: 'Cancel crop', exact: true }).click()
  assert.equal(await prisma.asset.count({ where: { projectId: project.id } }), 1)
  await controls.getByRole('button', { name: 'Crop', exact: true }).click()
  const handle = page.locator('.ReactCrop__drag-handle.ord-e')
  await handle.waitFor()
  await page.waitForFunction(() => !document.querySelector<HTMLButtonElement>('[aria-label="Crop controls"] button:last-of-type')?.disabled)
  const box = (await handle.boundingBox())!, preview = (await page.getByLabel('Image crop preview').boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down(); await page.mouse.move(box.x + box.width / 2 - preview.width / 4, box.y + box.height / 2, { steps: 10 }); await page.mouse.up()
  await page.screenshot({ path: '/tmp/image-inline-crop.png' })
  await page.getByRole('button', { name: 'Apply crop', exact: true }).click()
  await page.locator('[data-awb-image-editor]').waitFor({ state: 'detached' })
  const cropped = await prisma.asset.findFirstOrThrow({ where: { projectId: project.id, url: { not: original } } })
  const croppedMeta = await sharp(await assetBytes(cropped)).metadata()
  assert.ok(croppedMeta.width! < 800 && croppedMeta.width! > 500, `Crop exports source pixels: ${croppedMeta.width}`)
  assert.equal(croppedMeta.height, 400)
  assert.deepEqual(await readFile(path.join(directory, 'original.png')), bytes, 'Original bytes stay intact')
  const cropSrc = await photo.getAttribute('src')
  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  assert.ok(decodeURIComponent(await photo.getAttribute('src') || '').includes(original), 'Website Undo restores the original selection')
  await page.getByRole('button', { name: 'Redo', exact: true }).click()
  assert.equal(await photo.getAttribute('src'), cropSrc)
  console.log('PASS: inline drag crop, cancel without uploads, full-resolution cropped copy, original preservation, and website Undo/Redo.')
  await page.getByRole('button', { name: 'Save', exact: true }).click(); await page.getByRole('button', { name: 'Saved', exact: true }).waitFor()
  await page.reload(); await select()
  await controls.getByRole('button', { name: 'Edit image', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Edit image', exact: true })
  await dialog.waitFor()
  await dialog.locator('.FIE_root').waitFor()
  await dialog.getByRole('button', { name: 'Save image', exact: true }).waitFor()
  await page.waitForFunction(() => document.querySelectorAll('[data-awb-image-editor] canvas').length > 0)
  await page.screenshot({ path: '/tmp/image-editor-popup-desktop.png' })
  let noEditExport: Buffer | undefined
  await page.route('**/api/assets', async (route: any) => {
    const request = route.request()
    const form = await new Response(request.postDataBuffer(), { headers: { 'Content-Type': request.headers()['content-type'] } }).formData()
    noEditExport = Buffer.from(await (form.get('file') as File).arrayBuffer())
    await route.fulfill({ status: 503, json: { error: 'No-edit export check' } })
  })
  await dialog.getByRole('button', { name: 'Save image', exact: true }).click()
  await dialog.getByRole('alert').filter({ hasText: 'No-edit export check' }).waitFor()
  const unchangedMeta = await sharp(noEditExport!).metadata()
  assert.equal(unchangedMeta.width, croppedMeta.width, 'Opening the popup must not silently crop the image')
  assert.equal(unchangedMeta.height, croppedMeta.height, 'Opening the popup must preserve the original image height')
  await page.unroute('**/api/assets')
  console.log('PASS: opening the popup preserves the full source image dimensions.')
  for (const name of ['Finetune', 'Filters', 'Annotate']) { await dialog.getByText(name, { exact: true }).click() }
  assert.ok(await dialog.locator('.FIE_text-tool-button').isVisible(), 'Text annotation tool is available')
  await dialog.getByText('Adjust', { exact: true }).click()
  await dialog.locator('.FIE_rotate-tool-button').click()
  await dialog.locator('.FIE_rotate_button_right').click()
  await dialog.locator('.FIE_rotate_button_left').click()
  await dialog.locator('.FIE_flip-x-tool-button').click()
  await dialog.locator('.FIE_flip-y-tool-button').click()
  await dialog.locator('.FIE_flip-y-tool-button').click()
  await dialog.getByText('Resize', { exact: true }).click()
  const width = dialog.locator('input[name="width"]')
  await width.fill('160'); await width.press('Tab')
  let failNext = true
  await page.route('**/api/assets', async (route: any) => { if (failNext) { failNext = false; await route.fulfill({ status: 503, json: { error: 'Temporary upload test failure' } }) } else await route.fallback() })
  await dialog.getByRole('button', { name: 'Save image', exact: true }).click()
  await dialog.getByRole('alert').filter({ hasText: 'Temporary upload test failure' }).waitFor()
  assert.ok(await dialog.isVisible(), 'Failed uploads keep edits open for retry')
  await dialog.getByRole('button', { name: 'Save image', exact: true }).click()
  await dialog.waitFor({ state: 'detached' })
  const edited = await prisma.asset.findFirstOrThrow({ where: { projectId: project.id, url: { notIn: [original, cropped.url] } } })
  const editedMeta = await sharp(await assetBytes(edited)).metadata()
  assert.equal(editedMeta.width, 160, 'Resize exports the requested dimensions')
  assert.equal(editedMeta.format, 'png')
  const corner = await sharp(await assetBytes(edited)).extract({ left: 5, top: 5, width: 1, height: 1 }).raw().toBuffer()
  assert.ok(corner[2] > corner[0], 'Horizontal flip is baked into the saved image pixels')
  assert.equal(await prisma.asset.count({ where: { projectId: project.id } }), 3)
  await page.getByRole('button', { name: 'Save', exact: true }).click(); await page.getByRole('button', { name: 'Saved', exact: true }).waitFor()
  await page.reload(); await select()
  const saved = await prisma.websiteVersion.findFirstOrThrow({ where: { projectId: project.id, kind: 'DRAFT' }, orderBy: { version: 'desc' } })
  assert.equal((saved.model as any).pages[0].sections[0].props.imageUrl, edited.url)
  assert.equal((saved.model as any).pages[0].sections[0].props.imageAlt, 'Original test image')
  console.log('PASS: Filerobot popup, resize, upload failure/retry, new PNG asset, unchanged alt text, Save/reload persistence.')
  await controls.getByRole('button', { name: 'Edit image', exact: true }).click()
  await dialog.locator('.FIE_root').waitFor()
  await dialog.getByText('Resize', { exact: true }).click(); await dialog.locator('input[name="width"]').fill('96')
  await dialog.getByRole('button', { name: 'Close image editor', exact: true }).click()
  await dialog.getByRole('button', { name: 'Discard changes', exact: true }).click()
  assert.equal(await prisma.asset.count({ where: { projectId: project.id } }), 3)
  await page.setViewportSize({ width: 390, height: 844 }); await select()
  await controls.getByRole('button', { name: 'Edit image', exact: true }).click()
  await dialog.locator('.FIE_root').waitFor()
  await page.screenshot({ path: '/tmp/image-editor-popup-mobile.png' })
  const mobileBox = (await dialog.boundingBox())!
  assert.ok(mobileBox.x >= 0 && mobileBox.width <= 390 && mobileBox.y >= 0 && mobileBox.height <= 844)
  assert.deepEqual(errors, [])
  console.log('PASS: popup discard keeps selected image and library intact; popup fits mobile; no browser exceptions.')
} catch (error) {
  if (page) { await page.screenshot({ path: '/tmp/image-editor-test-failure.png' }).catch(() => {}); await writeFile('/tmp/image-editor-test-failure.html', await page.content()).catch(() => {}) }
  throw error
} finally {
  closing = true
  await context?.unrouteAll({ behavior: 'ignoreErrors' }); await browser?.close()
  if (project) { const assets = await prisma.asset.findMany({ where: { projectId: project.id } }); for (const asset of assets) { const file = path.resolve(localUploadRoot(), asset.storageKey); if (asset.url.startsWith('/uploads/') && file.startsWith(path.resolve(localUploadRoot()) + path.sep)) await rm(file, { force: true }); else if (!asset.url.startsWith('/uploads/') && process.env.S3_BUCKET) await s3.send(new DeleteObjectCommand({ Bucket: process.env.S3_BUCKET, Key: asset.storageKey })) } }
  if (workspace) await prisma.workspace.delete({ where: { id: workspace.id } })
  if (user) await prisma.user.delete({ where: { id: user.id } })
  await rm(directory, { recursive: true, force: true }); await prisma.$disconnect()
}
