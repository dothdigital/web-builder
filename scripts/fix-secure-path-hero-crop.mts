import { config } from 'dotenv'
config({ path: '.env', override: true, quiet: true })
import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync } from 'node:fs'
import { websiteModelSchema } from '@awb/website-model'
const { prisma } = await import('@awb/database')
const projectId = 'cmv8r9j240000twpapiu39z6x'
try {
 const current = await prisma.websiteVersion.findFirstOrThrow({ where: { projectId, kind: 'DRAFT' }, orderBy: { version: 'desc' } })
 const model = websiteModelSchema.parse(current.model)
 const home = model.pages.find(p => p.path === '/')!
 const hero = home.sections.find(s => s.id === 'hero')!
 assert.ok(hero.props.imageUrl)
 const sizes = hero.props.imageSizes as Record<string, Record<string, unknown>> | undefined
 hero.props.imageSizes = { ...sizes, '/imageUrl': { ...sizes?.['/imageUrl'], fit: 'contain' } }
 // Moved/resized elements retain an independent copy of the image settings.
 const fitMoved = (props: Record<string, unknown>): void => {
  if (props.imageUrl === hero.props.imageUrl) {
   const sizing = props.imageSizes as Record<string, Record<string, unknown>> | undefined
   props.imageSizes = { ...sizing, '/imageUrl': { ...sizing?.['/imageUrl'], fit: 'contain' } }
  }
  for (const entry of (props.freeElements ?? []) as Array<{ content: Record<string, unknown> }>) fitMoved(entry.content)
 }
 fitMoved(hero.props)
 const valid = websiteModelSchema.parse(model)
 const dir = '/home/ubuntu/webtummy-releases/editor-ai-image-20261015/deploy/rectification'
 mkdirSync(dir, { recursive: true, mode: 0o700 })
 writeFileSync(`${dir}/before-hero-crop-v${current.version}.json`, JSON.stringify(current), { mode: 0o600 })
 const saved = await prisma.$transaction(async tx => {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${projectId}))`
  const latest = await tx.websiteVersion.findFirstOrThrow({ where: { projectId, kind: 'DRAFT' }, orderBy: { version: 'desc' } })
  assert.equal(latest.id, current.id)
  const last = await tx.websiteVersion.findFirstOrThrow({ where: { projectId }, orderBy: { version: 'desc' } })
  const saved = await tx.websiteVersion.create({ data: { projectId, version: last.version + 1, kind: 'DRAFT', model: JSON.parse(JSON.stringify(valid)), schemaVersion: valid.schemaVersion, note: 'Show the full home hero photo without cropping: contain image fit.' } })
  await tx.page.updateMany({ where: { projectId, path: '/' }, data: { sections: JSON.parse(JSON.stringify(home.sections)) } })
  return saved
 })
 console.log(JSON.stringify({ savedVersion: saved.version, heroFit: 'contain', photoUnchanged: true }))
} finally { await prisma.$disconnect() }
