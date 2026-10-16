import { config } from 'dotenv'
config({ path: '.env', override: true, quiet: true })
import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync } from 'node:fs'
import { websiteModelSchema } from '@awb/website-model'
import { removeMisplacedPersonalPhotos, allowsPersonalPhoto } from '../packages/pipeline/src/personal-photo-policy'
const { prisma } = await import('@awb/database')
const projectId = 'cmv8r9j240000twpapiu39z6x'
const apply = process.argv.includes('--apply')
try {
 const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId }, include: { assets: true } })
 const version = await prisma.websiteVersion.findFirstOrThrow({ where: { projectId, kind: 'DRAFT' }, orderBy: { version: 'desc' } })
 const model = websiteModelSchema.parse(version.model)
 const media = project.intakeMedia as { photos: Array<{ assetId: string; purpose: string }> }
 const ids = new Set(media.photos.filter(p => p.purpose === 'personal').map(p => p.assetId))
 const personal = new Set(project.assets.filter(a => ids.has(a.id)).map(a => a.url))
 assert.equal(personal.size, 2)
 const assets = project.assets.filter(a => a.source === 'AI_GENERATED' && a.kind === 'IMAGE')
 const asset = (part: string) => { const a = assets.find(a => a.url.includes(part)); assert.ok(a, part); return a }
 const planning = asset('-considerations-2.png')
 const insurance = asset('-choosing-coverage-1.png')
 const locations = asset('-why-secure-path-0.png')
 const services = asset('-services-areas-14.png')
 const changes: string[] = []
 const originals = new Map<string, string>()
 for (const page of model.pages) for (const section of page.sections) if (typeof section.props.imageUrl === 'string') originals.set(`${page.id}:${section.id}`, section.props.imageUrl)
 // A gallery containing only the same owner portraits duplicates the introductions.
 for (const page of model.pages) page.sections = page.sections.filter(section => {
   const images = section.props.images as Array<{ url?: string }> | undefined
   if (section.componentId === 'GalleryAsymmetric' && images?.length && images.every(image => image.url && personal.has(image.url))) { changes.push(`${page.path}: removed duplicate portrait gallery ${section.id}`); return false }
   return true
 })
 removeMisplacedPersonalPhotos(model, personal)
 for (const page of model.pages) {
  const ownIllustration = page.sections.map(s => assets.find(a => a.url === s.props.imageUrl)).find(Boolean)
  for (const section of page.sections) {
   const key = `${page.id}:${section.id}`
   if (!personal.has(originals.get(key) ?? '') || allowsPersonalPhoto(model, `${key}:/imageUrl`)) continue
   const relevant = page.path === '/' ? section.id === 'service-areas' ? locations : planning
     : page.path === '/contact' ? services
     : page.path === '/about' ? planning
     : ownIllustration ?? (page.path.startsWith('/insurance') ? insurance : planning)
   section.props.imageUrl = relevant.url
   section.props.imageAlt = relevant.altText ?? ''
   changes.push(`${page.path}: ${section.id} portrait replaced with relevant illustration`)
  }
 }
 const valid = websiteModelSchema.parse(model)
 // Verify every retained portrait reference, including nested card and background fields.
 for (const page of valid.pages) {
  let count = 0
  const inspect = (value: unknown, pointer: string, sectionId: string): void => {
   if (typeof value === 'string' && personal.has(value)) { assert.ok(allowsPersonalPhoto(valid, `${page.id}:${sectionId}:${pointer}`), `${page.path} ${sectionId}${pointer}`); count++ }
   else if (value && typeof value === 'object') for (const [key, item] of Object.entries(value)) inspect(item, `${pointer}/${key}`, sectionId)
  }
  for (const section of page.sections) inspect(section.props, '', section.id)
  assert.equal(count, ['/', '/about'].includes(page.path) ? 1 : 0, page.path)
 }
 const backupDir = '/home/ubuntu/webtummy-releases/portrait-placement-20261015/deploy/rectification'
 mkdirSync(backupDir, { recursive: true, mode: 0o700 })
 writeFileSync(`${backupDir}/before-v${version.version}.json`, JSON.stringify(version), { mode: 0o600 })
 writeFileSync(`${backupDir}/proposed.json`, JSON.stringify(valid), { mode: 0o600 })
 console.log(JSON.stringify({ apply, sourceVersion: version.version, changes }, null, 2))
 if (apply) {
  const saved = await prisma.$transaction(async tx => {
   await tx.$queryRaw`SELECT id FROM "Project" WHERE id = ${projectId} FOR UPDATE`
   const current = await tx.websiteVersion.findFirstOrThrow({ where: { projectId, kind: 'DRAFT' }, orderBy: { version: 'desc' } })
   assert.equal(current.id, version.id, 'Draft changed; rerun against the latest version')
   const last = await tx.websiteVersion.findFirstOrThrow({ where: { projectId }, orderBy: { version: 'desc' } })
   const next = await tx.websiteVersion.create({ data: { projectId, version: last.version + 1, kind: 'DRAFT', model: JSON.parse(JSON.stringify(valid)), schemaVersion: valid.schemaVersion, note: 'Correct personal photo placement: introductions only; contextual illustrations elsewhere; remove duplicate portrait gallery.' } })
   for (const page of valid.pages) await tx.page.updateMany({ where: { projectId, path: page.path }, data: { sections: JSON.parse(JSON.stringify(page.sections)) } })
   return next
  })
  console.log(JSON.stringify({ savedVersion: saved.version, id: saved.id }))
 }
} finally { await prisma.$disconnect() }
