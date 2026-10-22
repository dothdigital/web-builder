import assert from 'node:assert/strict'
import { prisma } from '@awb/database'
import { getComponent, importedSection } from '@awb/component-registry'
import { websiteModelSchema, validateWebsiteModel } from '@awb/website-model'
import { allowsPersonalPhoto, removeMisplacedPersonalPhotos } from '../packages/pipeline/src/personal-photo-policy'
const projectId = process.argv[2]
assert.ok(projectId, 'Provide a project ID')
try {
  const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId }, include: { assets: { where: { source: 'UPLOAD', kind: 'IMAGE' } } } })
  const latest = await prisma.websiteVersion.findFirstOrThrow({ where: { projectId, kind: 'DRAFT' }, orderBy: { version: 'desc' } })
  const model = websiteModelSchema.parse(latest.model)
  const media = project.intakeMedia as { photos?: Array<{ assetId: string; purpose: string; description: string }> } | null
  const selected = media?.photos?.find(photo => photo.purpose === 'personal' || /personal photo|agent photo|portrait/i.test(photo.description))
  assert.ok(selected, 'No explicitly described personal photo was supplied')
  const asset = project.assets.find(asset => asset.id === selected.assetId)
  assert.ok(asset, 'The selected portrait asset is missing')
  const unresolved = model.pages.flatMap(page => page.sections.filter(section => !getComponent(section.componentId)).map(section => `${page.path}: ${section.componentId}`))
  assert.deepEqual(unresolved, [], 'Every saved component must resolve, including inner pages')
  removeMisplacedPersonalPhotos(model, new Set([asset.url]))
  const placements: string[] = []
  for (const page of model.pages) {
    for (const section of page.sections) {
      if (!allowsPersonalPhoto(model, `${page.id}:${section.id}:/imageUrl`)) continue
      assert.equal(importedSection(section.componentId)?.family, 'ABOUT', 'Repair targets biography sections only')
      section.props.imageUrl = asset.url
      section.props.imageAlt = selected.description || 'Agent portrait supplied by the business'
      placements.push(`${page.path} ${section.componentId}`)
    }
  }
  assert.ok(placements.length, 'No biography slots matched')
  const validation = validateWebsiteModel(model)
  assert.ok(validation.valid, JSON.stringify(validation.issues))
  console.log(JSON.stringify({ unresolvedComponents: unresolved.length, portraitPlacements: placements, previousVersion: latest.version }))
  if (process.argv.includes('--apply')) {
    await prisma.$transaction(async tx => {
      const current = await tx.websiteVersion.findFirstOrThrow({ where: { projectId }, orderBy: { version: 'desc' } })
      assert.equal(current.id, latest.id, 'Draft changed; rerun against the latest version')
      for (const page of model.pages) await tx.page.updateMany({ where: { projectId, path: page.path }, data: { sections: JSON.parse(JSON.stringify(page.sections)) } })
      await tx.websiteVersion.create({ data: { projectId, version: current.version + 1, kind: 'DRAFT', schemaVersion: model.schemaVersion, model: JSON.parse(JSON.stringify(model)), note: 'Place the supplied agent portrait in homepage and About biography sections; retain existing content, colours, navigation and previous drafts' } })
      if (media?.photos) await tx.project.update({ where: { id: projectId }, data: { intakeMedia: { ...media, photos: media.photos.map(photo => photo.assetId === selected.assetId ? { ...photo, purpose: 'personal' } : photo) } } })
    })
    console.log(`Saved repaired draft version ${latest.version + 1}.`)
  }
} finally { await prisma.$disconnect() }
