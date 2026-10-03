import 'dotenv/config'
import { config } from 'dotenv'
config({ override: true, quiet: true })
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { prisma } from '@awb/database'
import { websiteModelSchema } from '@awb/website-model'
import { resolvePreviewAssets } from '../apps/web/src/lib/preview-assets'
import { SiteRenderer } from '../apps/web/src/components/site-renderer'
Object.assign(globalThis, { React })
async function main() {
  const projectId = process.argv[2]
  assert.ok(projectId, 'Provide a project ID')
  const version = await prisma.websiteVersion.findFirstOrThrow({ where: { projectId, kind: 'DRAFT' }, orderBy: { version: 'desc' } })
  const original = websiteModelSchema.parse(version.model)
  const snapshot = JSON.stringify(original)
  const model = await resolvePreviewAssets(projectId, original)
  assert.equal(JSON.stringify(original), snapshot, 'Stored model must not be mutated')
  const home = model.pages.find((page) => page.path === '/')!
  const html = renderToStaticMarkup(React.createElement(SiteRenderer, { model, page: home, baseUrl: `/preview/${projectId}` }))
  assert.ok(html.includes('--awb-primary:#0279c2'), 'Expected saved blue brand colour')
  assert.ok(html.includes('--awb-accent:#53b849'), 'Expected saved green accent')
  assert.ok(html.includes('background:var(--awb-primary)'), 'Expected brand-coloured section backgrounds')
  const headerHtml = html.match(/<header[\s\S]*?<\/header>/)?.[0] ?? ''
  const footerHtml = html.match(/<footer[\s\S]*?<\/footer>/)?.[0] ?? ''
  assert.ok(headerHtml.includes('<details>'), 'Service links should be grouped in a dropdown')
  assert.ok(footerHtml.includes('Main links') && footerHtml.includes('Information') && footerHtml.includes('Get in touch'))
  assert.ok(footerHtml.includes('<img'), 'Footer should display logo')
  assert.ok(html.includes('minmax(min(100%, 360px), 1fr)'), 'Hero should use responsive two-column layout')
  const urls = [...html.matchAll(/<img[^>]+src="([^"]+)"/g)].map((match) => match[1]!.replace(/&amp;/g, '&'))
  assert.ok(urls.length >= 3, 'Expected logo, hero, and about image')
  for (const url of urls) {
    const response = await fetch(url, { headers: { Range: 'bytes=0-31' }, signal: AbortSignal.timeout(20000) })
    assert.ok(response.ok, `Image request failed: ${response.status}`)
    assert.ok(response.headers.get('content-type')?.startsWith('image/'))
    await response.arrayBuffer()
  }
  console.log(`PASS: ${urls.length} rendered images return image data; footer, shortened menu, two-column hero, brand colours and saved URLs verified`)
}
main().finally(() => prisma.$disconnect())
