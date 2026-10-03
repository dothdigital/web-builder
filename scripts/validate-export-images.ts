import 'dotenv/config'
import { config } from 'dotenv'
config({ override: true, quiet: true })
import assert from 'node:assert/strict'
import React from 'react'
import JSZip from 'jszip'
import path from 'node:path'
import { writeFile } from 'node:fs/promises'
import { prisma } from '@awb/database'
import { websiteModelSchema } from '@awb/website-model'
import { resolvePreviewAssets } from '../apps/web/src/lib/preview-assets'
import { buildStaticExport, ExportAssetError } from '../apps/web/src/lib/static-export'
Object.assign(globalThis, { React })
async function main() {
  const projectId = process.argv[2]
  assert.ok(projectId, 'Provide a project ID')
  const version = await prisma.websiteVersion.findFirstOrThrow({ where: { projectId }, orderBy: { version: 'desc' } })
  const source = websiteModelSchema.parse(version.model)
  const model = await resolvePreviewAssets(projectId, source)
  const archive = await buildStaticExport(model, { siteUrl: 'https://example.com' })
  const zip = await JSZip.loadAsync(archive)
  const images = Object.values(zip.files).filter((file) => !file.dir && file.name.startsWith('assets/images/'))
  assert.ok(images.length > 0)
  for (const file of images) assert.ok((await file.async('nodebuffer')).length > 0)
  let references = 0
  const pages = Object.values(zip.files).filter((file) => file.name.endsWith('.html'))
  for (const file of pages) {
    const html = await file.async('string')
    assert.ok(!html.includes('X-Amz-'), 'Export must not contain expiring credentials')
    for (const match of html.matchAll(/<img[^>]+src="([^"]+)"/g)) {
      const src = match[1]!
      assert.ok(!src.startsWith('http') && !src.startsWith('/'), `${file.name} must use a relative image path`)
      const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(file.name), src))
      assert.ok(zip.file(resolved), `${file.name}: missing ${resolved}`)
      references += 1
    }
  }
  const outputPath = '/private/tmp/lifex-export-verified.zip'
  await writeFile(outputPath, archive)
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () => new Response('Unavailable', { status: 403 })
  try { await assert.rejects(buildStaticExport(model, { siteUrl: 'https://example.com' }), ExportAssetError) }
  finally { globalThis.fetch = originalFetch }
  console.log(`PASS: ${pages.length} pages, ${images.length} bundled images, ${references} image references resolve inside ZIP; missing images fail clearly. Archive: ${outputPath}`)
}
main().finally(() => prisma.$disconnect())
