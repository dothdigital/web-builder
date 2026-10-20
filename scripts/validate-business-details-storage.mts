import { config } from 'dotenv'
config({ path: '.env', quiet: true })
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { websiteModelSchema } from '@awb/website-model'
const { saveDraftModel, loadDraftModel } = await import('../apps/web/src/lib/website')
const { prisma } = await import('@awb/database')
let workspaceId: string | undefined
try {
  const tag = 'business-storage-check-' + randomUUID()
  const workspace = await prisma.workspace.create({ data: { name: tag, slug: tag } })
  workspaceId = workspace.id
  const project = await prisma.project.create({ data: { workspaceId, name: tag, slug: tag, previewHost: tag + '.preview.local', businessProfile: { create: { displayName: 'Intake name', email: 'old@example.com', addressLine1: 'Old address', missingFacts: [] } } } })
  const seed = await prisma.websiteVersion.findFirstOrThrow({ where: { kind: 'DRAFT' }, orderBy: { createdAt: 'asc' } })
  const model = websiteModelSchema.parse(seed.model)
  model.businessProfileRef = project.id
  model.businessDetails = { displayName: 'Updated name', description: 'Updated description', industry: '', tagline: '', audience: '', tone: '' }
  model.contact = { email: 'main@example.com', emails: ['main@example.com', 'team@example.com'], phone: '+1 555 1000', phones: ['+1 555 1000', '+1 555 2000'], addressLine1: 'New address', hours: [] }
  model.socials = [{ network: 'Instagram', url: 'https://instagram.com/example' }]
  await saveDraftModel(project.id, model, 'Isolated business details storage check')
  const saved = await loadDraftModel(project.id)
  assert.deepEqual(saved?.contact, model.contact)
  assert.deepEqual(saved?.businessDetails, model.businessDetails)
  assert.deepEqual(saved?.socials, model.socials)
  let profile = await prisma.businessProfile.findUniqueOrThrow({ where: { projectId: project.id } })
  assert.equal(profile.displayName, 'Updated name')
  assert.equal(profile.email, 'main@example.com')
  assert.equal(profile.addressLine1, 'New address')
  assert.equal((await prisma.socialLink.findFirstOrThrow({ where: { projectId: project.id } })).network, 'Instagram')
  model.contact = { email: '', emails: [], phone: '', phones: [], addressLine1: '', hours: [] }
  model.socials = []
  await saveDraftModel(project.id, model, 'Remove business details in isolated storage check')
  profile = await prisma.businessProfile.findUniqueOrThrow({ where: { projectId: project.id } })
  assert.equal(profile.email, null)
  assert.equal(profile.phone, null)
  assert.equal(profile.addressLine1, null)
  assert.equal(await prisma.socialLink.count({ where: { projectId: project.id } }), 0)
  assert.deepEqual((await loadDraftModel(project.id))?.contact.emails, [])
  assert.equal(await prisma.websiteVersion.count({ where: { projectId: project.id } }), 2)
  console.log('PASS: contacts and social profiles persist with the draft transaction; removals clear intake records; previous versions remain available.')
} finally {
  if (workspaceId) await prisma.workspace.delete({ where: { id: workspaceId } })
  await prisma.$disconnect()
}
