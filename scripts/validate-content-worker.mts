import 'dotenv/config'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { prisma } from '@awb/database'
import { runContentJob } from '../packages/pipeline/src/content-worker'
const id = randomUUID()
try {
  const project = await prisma.project.findFirstOrThrow({ select: { id: true, workspaceId: true } })
  // RUNNING bypasses the dispatcher. Invalid input fails before any AI call.
  await prisma.contentJob.create({ data: { id, projectId: project.id, workspaceId: project.workspaceId, requestedBy: 'worker-validation', kind: 'CREATE', title: 'Worker validation', status: 'RUNNING', input: {}, emailStatus: 'SKIPPED' } })
  await assert.rejects(runContentJob(id, false))
  let job = await prisma.contentJob.findUniqueOrThrow({ where: { id } })
  assert.equal(job.status, 'QUEUED')
  assert.equal(job.attempts, 1)
  await prisma.contentJob.update({ where: { id }, data: { status: 'RUNNING' } })
  await assert.rejects(runContentJob(id, true))
  job = await prisma.contentJob.findUniqueOrThrow({ where: { id } })
  assert.equal(job.status, 'FAILED')
  assert.equal(job.attempts, 2)
  assert.equal(job.dedupeKey, null)
  const result = { validation: 'persisted result' }
  await prisma.contentJob.update({ where: { id }, data: { status: 'READY', result } })
  assert.deepEqual(await runContentJob(id, true), result)
  assert.equal((await prisma.contentJob.findUniqueOrThrow({ where: { id } })).attempts, 2)
  console.log('PASS: durable retry, terminal failure, stored-result reuse; no AI calls or emails.')
} finally {
  await prisma.contentJob.deleteMany({ where: { id } })
  await prisma.$disconnect()
}
