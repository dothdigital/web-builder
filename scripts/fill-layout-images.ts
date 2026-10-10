import 'dotenv/config'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {prisma} from '@awb/database'
import {websiteModelSchema} from '@awb/website-model'
import {generationOptionsSchema} from '@awb/shared/generation-options'
import {collectImageSlots} from '../packages/pipeline/src/run'
async function main(){
 const projectId=process.argv[2]; assert.ok(projectId,'Provide a project ID')
 const project=await prisma.project.findUniqueOrThrow({where:{id:projectId}})
 const saved=await prisma.websiteVersion.findFirstOrThrow({where:{projectId,kind:'DRAFT'},orderBy:{version:'desc'}})
 const slots=collectImageSlots(websiteModelSchema.parse(saved.model))
 console.log(JSON.stringify({draft:saved.version,missingImages:slots.length,pages:[...new Set(slots.map(slot=>slot.pageTitle))]}))
 if(!process.argv.includes('--queue') || !slots.length) return
 const prior=await prisma.contentJob.findFirstOrThrow({where:{projectId,kind:'WEBSITE'},orderBy:{createdAt:'desc'}})
 const options=generationOptionsSchema.parse({...prior.input as Record<string,unknown>,mode:'fill-images'})
 const id=randomUUID()
 await prisma.$transaction(async tx=>{
  const claimed=await tx.project.updateMany({where:{id:projectId,status:{not:'GENERATING'}},data:{status:'GENERATING'}})
  assert.equal(claimed.count,1,'A generation run is already active')
  await tx.contentJob.create({data:{id,projectId,workspaceId:project.workspaceId,requestedBy:prior.requestedBy,kind:'WEBSITE',title:'Complete missing layout images',input:JSON.parse(JSON.stringify(options)),emailStatus:'SKIPPED'}})
 })
 console.log(`Queued missing-image completion: ${id}`)
}
main().finally(()=>prisma.$disconnect())
