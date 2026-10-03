import 'dotenv/config'
import assert from 'node:assert/strict'
import { CloudFrontClient } from '@aws-sdk/client-cloudfront'
import { prisma } from '@awb/database'
import { syncHosting } from '../apps/web/src/lib/hosting/service'
async function main() {
  const keys = ['HOSTING_S3_BUCKET', 'HOSTING_AWS_REGION', 'HOSTING_CLOUDFRONT_OAC_ID', 'HOSTING_PUBLIC_API_URL']
  const env = keys.map((key) => [key, process.env[key]] as const)
  Object.assign(process.env, { HOSTING_S3_BUCKET: 'test-bucket', HOSTING_AWS_REGION: 'ca-central-1', HOSTING_CLOUDFRONT_OAC_ID: 'test-oac', HOSTING_PUBLIC_API_URL: 'https://app.webtummy.com' })
  const originals = { siteFind: prisma.hostingSite.findUniqueOrThrow, siteUpdate: prisma.hostingSite.update, domainFind: prisma.domain.findMany, domainUpdate: prisma.domain.updateMany, releaseFind: prisma.publishRelease.findUniqueOrThrow, releaseUpdate: prisma.publishRelease.update, projectUpdate: prisma.project.update, transaction: prisma.$transaction, send: CloudFrontClient.prototype.send }
  let distributionStatus = 'InProgress'; let invalidationStatus = 'InProgress'; let releaseStatus = 'DEPLOYING'; let origin = '/sites/project/release-invalid'
  const site = { projectId: 'project', distributionId: 'd1', status: 'DEPLOYING', deployedReleaseId: null, pendingReleaseId: 'release1', certificateArn: null }
  const release = { id: 'release1', createdAt: new Date(), validation: null as null | { invalidationId: string } }
  try {
    Object.assign(prisma.hostingSite, { findUniqueOrThrow: async () => ({ ...site }), update: async ({ data }: { data: object }) => Object.assign(site, data) })
    Object.assign(prisma.domain, { findMany: async () => [], updateMany: async () => ({ count: 0 }) })
    Object.assign(prisma.publishRelease, { findUniqueOrThrow: async () => ({ ...release }), update: async ({ data }: { data: { status?: string; validation?: { invalidationId: string } } }) => { if (data.status) releaseStatus = data.status; if (data.validation) release.validation = data.validation; return {} } })
    Object.assign(prisma.project, { update: async () => ({}) })
    Object.assign(prisma, { $transaction: async (operations: Promise<unknown>[]) => Promise.all(operations) })
    Object.assign(CloudFrontClient.prototype, { send: async (command: { constructor: { name: string } }) => {
      if (command.constructor.name === 'GetDistributionCommand') return { Distribution: { Status: distributionStatus, DistributionConfig: { Origins: { Items: [{ OriginPath: origin }] }, Aliases: { Items: [] } } } }
      if (command.constructor.name === 'CreateInvalidationCommand') return { Invalidation: { Id: 'invalidation1' } }
      if (command.constructor.name === 'GetInvalidationCommand') return { Invalidation: { Status: invalidationStatus } }
      throw new Error('Unexpected AWS command')
    } })
    await syncHosting('project'); assert.equal(releaseStatus, 'DEPLOYING')
    distributionStatus = 'Deployed'
    await syncHosting('project'); assert.equal(releaseStatus, 'DEPLOYING', 'Unrelated origin must not mark this release live')
    origin = '/sites/project/releases/release1'
    await syncHosting('project'); assert.equal(releaseStatus, 'DEPLOYING', 'Cache invalidation must complete first')
    invalidationStatus = 'Completed'
    await syncHosting('project'); assert.equal(releaseStatus, 'LIVE'); assert.equal(site.pendingReleaseId, null); assert.equal(site.deployedReleaseId, 'release1')
  } finally {
    Object.assign(prisma.hostingSite, { findUniqueOrThrow: originals.siteFind, update: originals.siteUpdate })
    Object.assign(prisma.domain, { findMany: originals.domainFind, updateMany: originals.domainUpdate })
    Object.assign(prisma.publishRelease, { findUniqueOrThrow: originals.releaseFind, update: originals.releaseUpdate })
    Object.assign(prisma.project, { update: originals.projectUpdate }); Object.assign(prisma, { $transaction: originals.transaction })
    Object.assign(CloudFrontClient.prototype, { send: originals.send })
    for (const [key, value] of env) { if (value === undefined) delete process.env[key]; else process.env[key] = value }
    await prisma.$disconnect()
  }
  console.log('PASS: only matching, deployed releases with completed cache refresh become LIVE. No database writes or AWS requests.')
}
void main()
