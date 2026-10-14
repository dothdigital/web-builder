import React from 'react'
import dotenv from 'dotenv'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
dotenv.config({ path: '.env', quiet: true })
;(globalThis as any).React = React
const { prisma } = await import('@awb/database')
const { saveDraftModel, loadDraftModel } = await import('../apps/web/src/lib/website')
const { deployQueuedPreview } = await import('../apps/web/src/lib/hosting/preview')
const { withHostingLock } = await import('../apps/web/src/lib/hosting/service')
const fixture = JSON.parse(await readFile('/home/ubuntu/webtummy-hosting-test-account.json', 'utf8'))
const id = fixture.projectId
try {
  const before = await prisma.hostingSite.findUniqueOrThrow({ where: { projectId: id } })
  assert.ok(before.previewHost && before.previewDeployedReleaseId)
  const model = await loadDraftModel(id)
  assert.ok(model)
  const result = await saveDraftModel(id, model, 'Automatic test-link integration verification', undefined, fixture.userId)
  assert.equal(result.testLinkQueued, true)
  const first = await prisma.hostingSite.findUniqueOrThrow({ where: { projectId: id } })
  assert.ok(first.previewRequestedVersionId)
  await saveDraftModel(id, model, 'Second save supersedes queued preview', undefined, fixture.userId)
  const queued = await prisma.hostingSite.findUniqueOrThrow({ where: { projectId: id } })
  assert.notEqual(queued.previewRequestedVersionId, first.previewRequestedVersionId)
  await withHostingLock(id, () => deployQueuedPreview(id))
  let after = await prisma.hostingSite.findUniqueOrThrow({ where: { projectId: id } })
  for (let attempt = 0; after.previewPendingReleaseId && attempt < 10; attempt++) {
    await new Promise(resolve => setTimeout(resolve, 1000))
    await withHostingLock(id, () => deployQueuedPreview(id))
    after = await prisma.hostingSite.findUniqueOrThrow({ where: { projectId: id } })
  }
  assert.equal(after.previewPendingReleaseId, null)
  const releaseId = after.previewDeployedReleaseId
  const release = await prisma.publishRelease.findUniqueOrThrow({ where: { id: releaseId! } })
  assert.equal(release.websiteVersionId, queued.previewRequestedVersionId)
  assert.equal(release.isPreview, true)
  assert.equal(after.previewRequestedVersionId, null)
  assert.equal(after.deployedReleaseId, before.deployedReleaseId)
  assert.equal(after.pendingReleaseId, before.pendingReleaseId)
  assert.equal(after.publicHost, before.publicHost)
  const lastRelease = after.previewDeployedReleaseId
  await withHostingLock(id, () => deployQueuedPreview(id))
  assert.equal((await prisma.hostingSite.findUniqueOrThrow({ where: { projectId: id } })).previewDeployedReleaseId, lastRelease)
  console.log('Passed: saves enqueue existing test link; latest save wins; preview deploys automatically; empty queue is idempotent; live release and domain unchanged.')
} finally { await prisma.$disconnect() }
