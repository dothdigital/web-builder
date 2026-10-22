import assert from 'node:assert/strict'
import { prisma } from '@awb/database'
import { websiteModelSchema, validateWebsiteModel } from '@awb/website-model'
const projectId = process.argv[2]
assert.ok(projectId, 'Provide a project ID')
try {
  const latest = await prisma.websiteVersion.findFirstOrThrow({ where: { projectId, kind: 'DRAFT' }, orderBy: { version: 'desc' } })
  const model = websiteModelSchema.parse(latest.model)
  const home = model.pages.find(page => page.path === '/')!
  const assets = await prisma.asset.findMany({ where: { projectId, kind: 'IMAGE', source: 'AI_GENERATED' } })
  // Reuse already-created artwork matching each section; no new AI calls.
  const repairs = [
    { componentId: 'Tpl_finbiz_1_4', field: 'imageUrl', matches: /insurance, travel and savings/i },
    { componentId: 'Tpl_finbiz_1_4', field: 'image1', matches: /long-term retirement saving/i },
    { componentId: 'Tpl_finbiz_1_9', field: 'imageUrl', matches: /insurance-industry experience/i },
    { componentId: 'Tpl_finbiz_1_12', field: 'imageUrl', matches: /empty enquiry form/i },
  ]
  for (const repair of repairs) {
    const section = home.sections.find(section => section.componentId === repair.componentId && !section.hidden)
    assert.ok(section, repair.componentId)
    const asset = assets.find(asset => repair.matches.test(asset.altText ?? ''))
    assert.ok(asset, `Matching saved artwork missing for ${repair.componentId}`)
    assert.ok(!section.props[repair.field], `Existing ${repair.field} must not be overwritten`)
    section.props[repair.field] = asset.url
    if (repair.field === 'imageUrl') section.props.imageAlt = asset.altText || ''
  }
  assert.ok(validateWebsiteModel(model).valid, 'Repaired draft must validate')
  console.log(JSON.stringify({ repairs: repairs.map(({ componentId, field }) => ({ componentId, field })), previousVersion: latest.version }))
  if (process.argv.includes('--apply')) {
    await prisma.$transaction(async tx => {
      const current = await tx.websiteVersion.findFirstOrThrow({ where: { projectId }, orderBy: { version: 'desc' } })
      assert.equal(current.id, latest.id, 'Draft changed; retry against the latest version')
      await tx.page.updateMany({ where: { projectId, path: '/' }, data: { sections: JSON.parse(JSON.stringify(home.sections)) } })
      await tx.websiteVersion.create({ data: { projectId, version: current.version + 1, kind: 'DRAFT', schemaVersion: model.schemaVersion, model: JSON.parse(JSON.stringify(model)), note: 'Complete missing homepage options, experience and contact images using existing relevant artwork; preserve text and previous drafts' } })
    })
    console.log(`Saved repaired draft version ${latest.version + 1}.`)
  }
} finally { await prisma.$disconnect() }
