import dotenv from 'dotenv'
import { readFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
dotenv.config({path:'.env',quiet:true})
const {prisma}=await import('@awb/database')
try {
const fixture=JSON.parse(await readFile('/home/ubuntu/webtummy-hosting-test-account.json','utf8'))
const site=await prisma.hostingSite.findUniqueOrThrow({where:{projectId:fixture.projectId}})
const draft=await prisma.websiteVersion.findFirstOrThrow({where:{projectId:fixture.projectId,kind:'DRAFT'},orderBy:{version:'desc'}})
const release=await prisma.publishRelease.findUniqueOrThrow({where:{id:site.previewDeployedReleaseId!}})
assert.equal(site.previewRequestedVersionId,null)
assert.equal(site.previewPendingReleaseId,null)
assert.equal(release.websiteVersionId,draft.id)
assert.equal(release.isPreview,true)
console.log('Passed: production background sync deployed the latest editor save to the test link.')
}finally{await prisma.$disconnect()}
