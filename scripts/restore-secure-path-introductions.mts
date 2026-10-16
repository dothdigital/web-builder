import { config } from 'dotenv'
config({ path: '.env', override: true, quiet: true })
import { mkdirSync, writeFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import { websiteModelSchema } from '@awb/website-model'
import { allowsPersonalPhoto } from '../packages/pipeline/src/personal-photo-policy'
const { prisma } = await import('@awb/database')
const projectId = 'cmv8r9j240000twpapiu39z6x'
try {
 const current = await prisma.websiteVersion.findFirstOrThrow({ where: { projectId, kind: 'DRAFT' }, orderBy: { version: 'desc' } })
 const previous = await prisma.websiteVersion.findUniqueOrThrow({ where: { projectId_version: { projectId, version: 2 } } })
 const model = websiteModelSchema.parse(current.model)
 const old = websiteModelSchema.parse(previous.model)
 const changes: string[] = []
 for (const page of model.pages) for (const section of page.sections) {
  if (!allowsPersonalPhoto(model, `${page.id}:${section.id}:/imageUrl`)) continue
  const original = old.pages.find(p => p.path === page.path)?.sections.find(s => s.id === section.id)
  assert.ok(original?.props.imageUrl && String(original.props.imageUrl).includes('whatsapp-image'))
  section.props.imageUrl = original.props.imageUrl
  section.props.imageAlt = original.props.imageAlt
  changes.push(`${page.path}:${section.id}`)
 }
 assert.deepEqual(changes, ['/:hero', '/about:about-hero'])
 const valid = websiteModelSchema.parse(model)
 // Preserve every other prop, section, page and new generated image from the rerun.
 const expected = structuredClone(current.model) as any
 for (const page of expected.pages) for (const section of page.sections) {
  const replacement = valid.pages.find(p => p.id === page.id)?.sections.find(s => s.id === section.id)
  if (changes.includes(`${page.path}:${section.id}`)) { section.props.imageUrl = replacement!.props.imageUrl; section.props.imageAlt = replacement!.props.imageAlt }
 }
 assert.deepEqual(JSON.parse(JSON.stringify(valid)), expected)
 const dir = '/home/ubuntu/webtummy-releases/portrait-preservation-20261015/deploy/rectification'
 mkdirSync(dir, { recursive: true, mode: 0o700 })
 writeFileSync(`${dir}/before-v${current.version}.json`, JSON.stringify(current), { mode: 0o600 })
 const saved = await prisma.$transaction(async tx => {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${projectId}))`
  const latest = await tx.websiteVersion.findFirstOrThrow({ where: { projectId, kind: 'DRAFT' }, orderBy: { version: 'desc' } })
  assert.equal(latest.id, current.id, 'Draft changed during repair')
  const last = await tx.websiteVersion.findFirstOrThrow({ where: { projectId }, orderBy: { version: 'desc' } })
  const saved = await tx.websiteVersion.create({ data: { projectId, version: last.version + 1, kind: 'DRAFT', model: JSON.parse(JSON.stringify(valid)), schemaVersion: valid.schemaVersion, note: 'Restore uploaded portraits in Home and About introductions; preserve all newly regenerated artwork.' } })
  for (const page of valid.pages.filter(p => ['/', '/about'].includes(p.path))) await tx.page.updateMany({ where: { projectId, path: page.path }, data: { sections: JSON.parse(JSON.stringify(page.sections)) } })
  return saved
 })
 console.log(JSON.stringify({ version: saved.version, restored: changes, otherChanges: 0 }))
} finally { await prisma.$disconnect() }
