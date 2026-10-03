import 'dotenv/config'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { prisma, AssetKind, AssetSource } from '@awb/database'
import { getComponent } from '@awb/component-registry'
import { websiteModelSchema } from '@awb/website-model'
import { rm } from 'node:fs/promises'
import path from 'node:path'
import { localUploadRoot } from '@awb/shared'

Object.assign(globalThis, { React })
process.env.AI_PROVIDER = 'stub'
process.env.MAX_AI_IMAGES = '0'

async function main() {
  const { runGeneration } = await import('@awb/pipeline')
  const workspace = await prisma.workspace.findFirstOrThrow()
  const project = await prisma.project.create({ data: {
    workspaceId: workspace.id, previewHost: `logo-test-${Date.now()}.preview.local`, name: 'Logo & Name Test', slug: `logo-test-${Date.now()}`,
    businessProfile: { create: { displayName: 'Logo & Name Test', description: 'A local business offering thoughtful professional services.', missingFacts: [] } },
  } })
  try {
    const first = await runGeneration({ projectId: project.id })
    const brand = await prisma.brandProfile.findUniqueOrThrow({ where: { projectId: project.id }, include: { logo: true } })
    assert.equal(brand.logo?.kind, AssetKind.LOGO)
    assert.equal(brand.logo?.source, AssetSource.AI_GENERATED)
    const version = await prisma.websiteVersion.findUniqueOrThrow({ where: { id: first.websiteVersionId } })
    const model = websiteModelSchema.parse(version.model)
    assert.equal(model.globalComponents.header.props.logoImageUrl, brand.logo?.url)
    for (const id of ['HeaderTransparent', 'HeaderSplitUtility']) {
      const definition = getComponent(id)!
      const Component = definition.render
      const html = renderToStaticMarkup(React.createElement(Component, { props: definition.propsSchema.parse(model.globalComponents.header.props), context: { tokens: model.tokens, baseUrl: '', editing: false } }))
      assert.ok(html.includes('<img'))
      assert.ok(html.includes('alt="Logo &amp; Name Test"'))
    }
    await runGeneration({ projectId: project.id })
    assert.equal(await prisma.asset.count({ where: { projectId: project.id, kind: AssetKind.LOGO } }), 1)
    const uploaded = await prisma.asset.create({ data: { workspaceId: workspace.id, projectId: project.id, kind: AssetKind.LOGO, source: AssetSource.UPLOAD, storageKey: 'test-only', url: '/uploads/test-logo.svg', mimeType: 'image/svg+xml' } })
    await prisma.brandProfile.update({ where: { projectId: project.id }, data: { logoAssetId: uploaded.id } })
    const third = await runGeneration({ projectId: project.id })
    const uploadedVersion = await prisma.websiteVersion.findUniqueOrThrow({ where: { id: third.websiteVersionId } })
    assert.equal(websiteModelSchema.parse(uploadedVersion.model).globalComponents.header.props.logoImageUrl, uploaded.url)
    assert.equal(await prisma.asset.count({ where: { projectId: project.id, kind: AssetKind.LOGO } }), 2)
    console.log('PASS: logo generation, saved-logo reuse, uploaded-logo precedence, and both header layouts')
  } finally {
    await prisma.project.delete({ where: { id: project.id } })
    await rm(path.join(localUploadRoot(), 'workspaces', workspace.id, 'projects', project.id), { recursive: true, force: true })
  }
}
main().finally(() => prisma.$disconnect())
