import { config } from 'dotenv'
config({ path: '.env', quiet: true })
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { getComponent } from '@awb/component-registry'
import { websiteModelSchema, validateWebsiteModel } from '@awb/website-model'
import { resolveSectionMedia } from '../apps/web/src/lib/section-media'
Object.assign(globalThis, { React })
const { prisma } = await import('@awb/database')
const projectId = 'cmv8r9j240000twpapiu39z6x'
try {
 const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId }, include: { assets: true } })
 assert.notEqual(project.status, 'GENERATING')
 const version = await prisma.websiteVersion.findFirstOrThrow({ where: { projectId, kind: 'DRAFT' }, orderBy: { version: 'desc' } })
 const model = websiteModelSchema.parse(version.model)
 const before = structuredClone(model)
 const assignments: Record<string, string> = { '/:about': '-choosing-coverage-1.png', '/:approach': '-considerations-2.png', '/:areas': '-why-secure-path-0.png', '/:enquiry': '-services-areas-14.png', '/about:service-reach': '-why-secure-path-0.png', '/about:enquire': '-services-areas-14.png' }
 const changes: string[] = []
 for (const page of model.pages) for (const section of page.sections) {
  const key = `${page.path}:${section.id}`
  const suffix = assignments[key]
  if (!suffix) continue
  assert.equal(section.props.imageUrl, '', `${key} changed; inspect before editing`)
  const asset = project.assets.find(asset => asset.source === 'AI_GENERATED' && asset.url.endsWith(suffix))
  assert.ok(asset, suffix)
  section.props.imageUrl = asset.url
  section.props.imageAlt = asset.altText ?? ''
  changes.push(key)
 }
 assert.equal(changes.length, 6)
 const expected = structuredClone(before)
 for (const page of expected.pages) for (const section of page.sections) {
  if (!assignments[`${page.path}:${section.id}`]) continue
  const updated = model.pages.find(item => item.id === page.id)!.sections.find(item => item.id === section.id)!
  section.props.imageUrl = updated.props.imageUrl
  section.props.imageAlt = updated.props.imageAlt
 }
 assert.deepEqual(model, expected, 'Only six image references and alt texts may change')
 const validation = validateWebsiteModel(model)
 assert.ok(validation.valid, JSON.stringify(validation.issues))
 const media = project.intakeMedia as { photos?: Array<{ assetId: string; purpose: string }> }
 const personalIds = new Set(media.photos?.filter(photo => photo.purpose === 'personal').map(photo => photo.assetId))
 const portraits = project.assets.filter(asset => personalIds.has(asset.id)).map(asset => asset.url)
 for (const page of model.pages) {
  let count = 0
  for (const section of page.sections.filter(section => !section.hidden)) {
   const definition = getComponent(section.componentId)
   if (!definition) continue
   const parsed = definition.propsSchema.parse(resolveSectionMedia(model, page, section))
   const html = renderToStaticMarkup(React.createElement(definition.render, { props: parsed, context: { tokens: model.tokens, baseUrl: '', pagePath: page.path } }))
   count += [...html.matchAll(/<img\b[^>]*>/g)].filter(match => portraits.some(url => match[0].includes(`src="${url}"`))).length
  }
  assert.equal(count, ['/', '/about'].includes(page.path) ? 1 : 0, page.path)
 }
 const backup = '/home/ubuntu/webtummy-releases/portrait-fallback-backups-20261016'
 await mkdir(backup, { recursive: true, mode: 0o700 })
 await writeFile(`${backup}/before-v${version.version}.json`, JSON.stringify(version), { mode: 0o600 })
 const saved = await prisma.$transaction(async tx => {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${projectId}))`
  const latest = await tx.websiteVersion.findFirstOrThrow({ where: { projectId, kind: 'DRAFT' }, orderBy: { version: 'desc' } })
  assert.equal(latest.id, version.id, 'Website changed; stop and inspect the latest draft')
  const last = await tx.websiteVersion.findFirstOrThrow({ where: { projectId }, orderBy: { version: 'desc' } })
  const saved = await tx.websiteVersion.create({ data: { projectId, version: last.version + 1, kind: 'DRAFT', schemaVersion: model.schemaVersion, model: JSON.parse(JSON.stringify(model)), note: 'Stop repeated owner portraits: contextual artwork in Home/About supporting sections; retain one original portrait per introduction.' } })
  for (const page of model.pages.filter(page => ['/', '/about'].includes(page.path))) await tx.page.updateMany({ where: { projectId, path: page.path }, data: { sections: JSON.parse(JSON.stringify(page.sections)) } })
  return saved
 })
 console.log(JSON.stringify({ savedVersion: saved.version, changedImageSlots: changes, expectedPortraits: { home: 1, about: 1, otherPages: 0 } }))
} finally { await prisma.$disconnect() }
