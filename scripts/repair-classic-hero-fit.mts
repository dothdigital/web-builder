import assert from 'node:assert/strict'
import { prisma } from '@awb/database'
import { getComponent } from '@awb/component-registry'
import { websiteModelSchema } from '@awb/website-model'
const projectId = process.argv[2]
assert.ok(projectId)
try {
  const latest = await prisma.websiteVersion.findFirstOrThrow({ where: { projectId, kind: 'DRAFT' }, orderBy: { version: 'desc' } })
  const model = websiteModelSchema.parse(latest.model)
  const home = model.pages.find(page => page.path === '/')!
  const hero = home.sections.find(section => section.componentId === 'Tpl_finbiz_1_1')!
  assert.ok(hero?.props.imageUrl, 'A hero photo must already be selected')
  hero.props.heroImageFit = 'contain'
  assert.ok(getComponent(hero.componentId)!.propsSchema.safeParse(hero.props).success)
  await prisma.$transaction(async tx => {
    const current = await tx.websiteVersion.findFirstOrThrow({ where: { projectId }, orderBy: { version: 'desc' } })
    assert.equal(current.id, latest.id, 'Draft changed; retry')
    await tx.page.updateMany({ where: { projectId, path: '/' }, data: { sections: JSON.parse(JSON.stringify(home.sections)) } })
    await tx.websiteVersion.create({ data: { projectId, version: current.version + 1, kind: 'DRAFT', schemaVersion: model.schemaVersion, model: JSON.parse(JSON.stringify(model)), note: 'Fit the supplied portrait inside the Classic hero without cropping; retain all content and previous drafts' } })
  })
  console.log(`Saved draft ${latest.version + 1}: hero portrait-fit enabled, image and text unchanged.`)
} finally { await prisma.$disconnect() }
