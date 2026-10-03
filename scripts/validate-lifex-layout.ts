import 'dotenv/config'
import { config } from 'dotenv'
config({ override: true, quiet: true })
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { prisma } from '@awb/database'
import { getComponent } from '@awb/component-registry'
import { websiteModelSchema } from '@awb/website-model'
import { resolvePreviewAssets } from '../apps/web/src/lib/preview-assets'
import { resolveSectionMedia } from '../apps/web/src/lib/section-media'
import { SiteRenderer } from '../apps/web/src/components/site-renderer'
Object.assign(globalThis, { React })
async function main() {
  const projectId = 'cmubp1pkj000akpuj3wg26x7d'
  const version = await prisma.websiteVersion.findFirstOrThrow({ where: { projectId }, orderBy: { version: 'desc' } })
  const original = websiteModelSchema.parse(version.model)
  const snapshot = JSON.stringify(original)
  const model = await resolvePreviewAssets(projectId, original)
  const urls = new Set<string>()
  for (const path of ['/', '/about', '/investments']) {
    const page = model.pages.find((candidate) => candidate.path === path)!
    let cards = 0
    for (const section of page.sections) {
      const props = resolveSectionMedia(model, page, section)
      if (getComponent(section.componentId)?.family === 'SERVICES') {
        for (const item of props.items as Array<Record<string, unknown>>) {
          assert.ok(item.imageUrl, `Missing image: ${path} ${item.title}`)
          cards += 1
        }
      }
      if (section.componentId === 'AboutSplitOverlap') assert.ok(props.imageUrl, `Missing story image: ${path}`)
    }
    const html = renderToStaticMarkup(React.createElement(SiteRenderer, { model, page, baseUrl: `/preview/${projectId}` }))
    assert.ok(html.includes('minmax(min(100%, 360px), 1fr)'), 'Responsive hero columns')
    assert.ok(!html.includes('<div style="max-width:18ch"'), 'No narrow hero text-column wrapper')
    for (const match of html.matchAll(/<img[^>]+src="([^"]+)"/g)) urls.add(match[1]!.replace(/&amp;/g, '&'))
    console.log(`PASS ${path}: ${cards} cards have images, supporting image present, responsive hero`)
  }
  for (const url of urls) {
    const response = await fetch(url, { headers: { Range: 'bytes=0-31' }, signal: AbortSignal.timeout(20000) })
    assert.ok(response.ok && response.headers.get('content-type')?.startsWith('image/'), `Image status ${response.status}`)
    await response.arrayBuffer()
  }
  assert.equal(JSON.stringify(original), snapshot)
  console.log(`PASS: ${urls.size} distinct images accessible; saved model unchanged`)
}
main().finally(() => prisma.$disconnect())
