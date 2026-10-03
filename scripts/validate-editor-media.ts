import 'dotenv/config'
import assert from 'node:assert/strict'
import { prisma } from '@awb/database'
import { websiteModelSchema } from '@awb/website-model'
import { getComponent } from '@awb/component-registry'
import { resolveEditorMedia } from '../apps/web/src/lib/editor-media'
import { resolveSectionMedia } from '../apps/web/src/lib/section-media'
async function main() {
  const projectId = 'cmubp1pkj000akpuj3wg26x7d'
  const version = await prisma.websiteVersion.findFirstOrThrow({ where: { projectId }, orderBy: { version: 'desc' } })
  const model = websiteModelSchema.parse(version.model)
  const original = JSON.stringify(model)
  const assets = await prisma.asset.findMany({ where: { projectId } })
  const urls = Object.fromEntries(assets.map((asset) => [asset.url, `/api/projects/${projectId}/editor-image?url=${encodeURIComponent(asset.url)}`]))
  const rendered = resolveEditorMedia(model, urls)
  websiteModelSchema.parse(rendered)
  for (const global of Object.values(rendered.globalComponents)) assert.ok(getComponent(global.componentId)!.propsSchema.safeParse(global.props).success)
  let checked = 0
  model.pages.forEach((page, pageIndex) => page.sections.forEach((section, sectionIndex) => {
    const expected = resolveSectionMedia(model, page, section)
    const actual = rendered.pages[pageIndex]!.sections[sectionIndex]!.props
    if (expected.imageUrl) { assert.equal(actual.imageUrl, urls[expected.imageUrl as string] ?? expected.imageUrl); checked++ }
    assert.ok(getComponent(section.componentId)!.propsSchema.safeParse(actual).success)
  }))
  assert.equal(JSON.stringify(model), original)
  assert.ok(checked > 0)
  console.log(`PASS: ${model.pages.length} editor pages match preview media selection, ${checked} section images authenticated; canonical model unchanged.`)
}
main().finally(() => prisma.$disconnect())
