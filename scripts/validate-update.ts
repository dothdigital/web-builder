import 'dotenv/config'
import assert from 'node:assert/strict'
import React from 'react'
// The standalone runner uses classic JSX for workspace dependencies.
Object.assign(globalThis, { React })
import JSZip from 'jszip'
import { prisma } from '@awb/database'
import { websiteModelSchema } from '@awb/website-model'
import { buildStaticExport } from '../apps/web/src/lib/static-export'

async function main() {
  const columns = await prisma.$queryRaw<Array<{ column_name: string }>>`SELECT column_name FROM information_schema.columns WHERE table_name = 'Integration' AND column_name IN ('googleBusinessUrl', 'googleMapsUrl', 'googlePlaceId')`
  assert.equal(columns.length, 3)
  const version = await prisma.websiteVersion.findFirstOrThrow({ orderBy: { createdAt: 'desc' } })
  const model = websiteModelSchema.parse(version.model)
  // Keep this regression check offline, without fetching third-party images.
  const removeImages = (value: unknown): unknown => {
    if (typeof value === 'string' && /^(\/uploads\/|https?:\/\/)/.test(value) && /\.(png|jpe?g|webp|avif|gif|svg)(\?|$)/i.test(value)) return ''
    if (Array.isArray(value)) return value.map(removeImages)
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, removeImages(entry)]))
    return value
  }
  const clean = websiteModelSchema.parse(removeImages(model))
  clean.site.name = '</script><script>alert(1)</script>'
  clean.pages[0]!.seo.canonical = '/canonical-test'
  const zip = await JSZip.loadAsync(await buildStaticExport(clean, { siteUrl: 'https://example.com' }))
  const page = clean.pages[0]!
  const name = page.path.replace(/^\/+|\/+$/g, '')
  const html = await zip.file(name ? `${name}/index.html` : 'index.html')!.async('string')
  assert.ok(html.includes('href="https://example.com/canonical-test"'))
  assert.ok(!html.includes('</script><script>alert(1)</script>'))
  for (const file of ['assets/site.css', 'sitemap.xml', 'robots.txt', 'llms.txt']) assert.ok(zip.file(file), file)
  console.log(`PASS: database columns, existing model compatibility, ${clean.pages.length}-page ZIP export, canonical URLs and script escaping`)
}
main().finally(() => prisma.$disconnect())
