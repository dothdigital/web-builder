import { config } from 'dotenv'
config({ path: '.env', override: true, quiet: true })
import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync } from 'node:fs'
import { websiteModelSchema, validateWebsiteModel } from '@awb/website-model'
import { validateSectionProps } from '@awb/component-registry'
import { buildFaqJsonLd } from '@awb/seo'
import { prepareSecurePathSeo } from './secure-path-seo.mjs'
const { prisma } = await import('@awb/database')
const projectId = 'cmv8r9j240000twpapiu39z6x'
try {
 const current = await prisma.websiteVersion.findFirstOrThrow({ where: { projectId, kind: 'DRAFT' }, orderBy: { version: 'desc' } })
 const original = websiteModelSchema.parse(current.model)
 const model = prepareSecurePathSeo(original)
 assert.ok(validateWebsiteModel(model).valid)
 for (const page of model.pages) {
  assert.ok(buildFaqJsonLd(page), `${page.path} has visible FAQs`)
  assert.ok(page.seo.title.length <= 60)
  assert.ok(page.seo.description.length >= 120 && page.seo.description.length <= 160, `${page.path}: ${page.seo.description.length}`)
  for (const section of page.sections) assert.ok(validateSectionProps(section.id, section.componentId, section.props).ok, section.id)
  const before = original.pages.find(p => p.id === page.id)!
  for (const section of before.sections) assert.deepEqual(page.sections.find(s => s.id === section.id), section, 'Existing page content and image placements are preserved')
 }
 if (!process.argv.includes('--apply')) { console.log(JSON.stringify({ mode: 'review', sourceVersion: current.version, pages: model.pages.length, faqPages: model.pages.filter(page => buildFaqJsonLd(page)).length })); process.exitCode = 0 }
 else {
  const dir = '/home/ubuntu/webtummy-releases/image-seo-20261015/deploy/rectification'
  mkdirSync(dir, { recursive: true, mode: 0o700 })
  writeFileSync(`${dir}/before-seo-v${current.version}.json`, JSON.stringify(current), { mode: 0o600 })
  const saved = await prisma.$transaction(async tx => {
   await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${projectId}))`
   const latest = await tx.websiteVersion.findFirstOrThrow({ where: { projectId, kind: 'DRAFT' }, orderBy: { version: 'desc' } })
   assert.equal(latest.id, current.id, 'Draft changed during rectification; reload before retrying')
   const last = await tx.websiteVersion.findFirstOrThrow({ where: { projectId }, orderBy: { version: 'desc' } })
   const saved = await tx.websiteVersion.create({ data: { projectId, version: last.version + 1, kind: 'DRAFT', model: JSON.parse(JSON.stringify(model)), schemaVersion: model.schemaVersion, note: 'Page-specific SEO titles, descriptions and keyword targets; visible FAQs on every page. Preserve uploaded portraits, images, content and manual layout.' } })
   for (const page of model.pages) await tx.page.updateMany({ where: { projectId, path: page.path }, data: { seoTitle: page.seo.title, seoDescription: page.seo.description, canonicalUrl: page.seo.canonical, sections: JSON.parse(JSON.stringify(page.sections)) } })
   return saved
  })
  console.log(JSON.stringify({ savedVersion: saved.version, pages: model.pages.length, faqPages: model.pages.length, existingContentPreserved: true }))
 }
} finally { await prisma.$disconnect() }
