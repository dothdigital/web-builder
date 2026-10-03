import 'dotenv/config'
import assert from 'node:assert/strict'
import { prisma } from '@awb/database'
import { POST } from '../apps/web/src/app/api/visits/route'
async function main() {
  const project = prisma.project.findUnique
  const count = prisma.websiteVisit.count
  const upsert = prisma.websiteVisit.upsert
  let writes = 0
  let payload: Record<string, unknown> | undefined
  // Mock only the storage boundary: exercise real endpoint validation and hashing.
  Object.assign(prisma.project, { findUnique: async () => ({ id: 'test', previewHost: 'test.preview.local', domains: [], integration: { analyticsTrackingHost: 'example.com' } }) })
  Object.assign(prisma.websiteVisit, { count: async () => 0, upsert: async (input: { create: Record<string, unknown> }) => { writes++; payload = input.create } })
  const visit = { id: crypto.randomUUID(), projectId: 'test', visitor: crypto.randomUUID(), path: '/about?private=secret', referrer: 'google.com' }
  const request = (origin: string, body = JSON.stringify(visit)) => new Request('https://builder.example/api/visits', { method: 'POST', headers: { origin }, body })
  try {
    assert.equal((await POST(request('https://unrelated.example'))).status, 403)
    assert.equal(writes, 0)
    assert.equal((await POST(request('https://example.com', '{}'))).status, 400)
    assert.equal((await POST(request('https://example.com'))).status, 204)
    assert.equal(writes, 1)
    assert.equal(payload?.pagePath, '/about')
    assert.notEqual(payload?.visitorHash, visit.visitor)
    assert.ok(!JSON.stringify(payload).includes('private'))
    Object.assign(prisma.websiteVisit, { count: async () => 30 })
    assert.equal((await POST(request('https://example.com'))).status, 429)
    assert.equal(writes, 1)
  } finally { Object.assign(prisma.project, { findUnique: project }); Object.assign(prisma.websiteVisit, { count, upsert }); await prisma.$disconnect() }
  console.log('PASS: tracking host isolation, payload validation, query stripping, visitor hashing and burst limits; no database writes.')
}
void main()
