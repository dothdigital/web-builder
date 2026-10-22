import assert from 'node:assert/strict'
import { prisma } from '@awb/database'
import { websiteModelSchema, validateWebsiteModel } from '@awb/website-model'
const projectId = process.argv[2]
assert.ok(projectId)
try {
  const latest = await prisma.websiteVersion.findFirstOrThrow({ where: { projectId, kind: 'DRAFT' }, orderBy: { version: 'desc' } })
  const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId }, include: { assets: { where: { kind: 'IMAGE' } } } })
  const model = websiteModelSchema.parse(latest.model)
  const home = model.pages.find(page => page.path === '/')!
  const media = project.intakeMedia as { photos: Array<{ assetId: string; purpose: string }> }
  const personal = project.assets.find(asset => asset.id === media.photos.find(photo => photo.purpose === 'personal')?.assetId)
  assert.ok(personal)
  const hero = home.sections.find(section => section.componentId === 'Tpl_finbiz_1_1')!
  hero.props.imageUrl = personal.url
  hero.props.imageAlt = 'Uploaded agent portrait'
  const assignments = [
    { componentId: 'Tpl_finbiz_1_2', field: 'imageUrl', pattern: /insurance-industry experience/i },
    { componentId: 'Tpl_finbiz_1_9', field: 'imageUrl', pattern: /long-term retirement saving/i },
    { componentId: 'Tpl_finbiz_1_4', field: 'image1', pattern: /education savings/i },
  ]
  for (const assignment of assignments) {
    const asset = project.assets.find(asset => assignment.pattern.test(asset.altText ?? ''))
    const section = home.sections.find(section => section.componentId === assignment.componentId)
    assert.ok(asset && section)
    section.props[assignment.field] = asset.url
    if (assignment.field === 'imageUrl') section.props.imageAlt = asset.altText || ''
  }
  assert.ok(validateWebsiteModel(model).valid)
  await prisma.$transaction(async tx => {
    const current = await tx.websiteVersion.findFirstOrThrow({ where: { projectId }, orderBy: { version: 'desc' } })
    assert.equal(current.id, latest.id, 'Draft changed; retry')
    await tx.page.updateMany({ where: { projectId, path: '/' }, data: { sections: JSON.parse(JSON.stringify(home.sections)) } })
    await tx.websiteVersion.create({ data: { projectId, version: current.version + 1, kind: 'DRAFT', schemaVersion: model.schemaVersion, model: JSON.parse(JSON.stringify(model)), note: 'Use supplied agent photo in homepage hero and distinct saved planning artwork in supporting sections; preserve all copy and prior drafts' } })
  })
  console.log(`Saved draft ${latest.version + 1}: uploaded agent hero, distinct supporting images, original text preserved.`)
} finally { await prisma.$disconnect() }
