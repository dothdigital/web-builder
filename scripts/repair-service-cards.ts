import 'dotenv/config'
import assert from 'node:assert/strict'
import {prisma} from '@awb/database'
import {websiteModelSchema,validateWebsiteModel} from '@awb/website-model'
import {alignTemplateServiceCards} from '@awb/component-registry'
async function main(){
 const projectId=process.argv[2];assert.ok(projectId,'Provide a project ID')
 const saved=await prisma.websiteVersion.findFirstOrThrow({where:{projectId,kind:'DRAFT'},orderBy:{version:'desc'}})
 const assets=await prisma.asset.findMany({where:{projectId,source:'AI_GENERATED',kind:'IMAGE'},select:{url:true}})
 const source=websiteModelSchema.parse(saved.model)
 const model=alignTemplateServiceCards(source,{reuseHomeImages:true,replaceableImages:new Set(assets.map(asset=>asset.url))})
 assert.ok(validateWebsiteModel(model).valid)
 if(JSON.stringify(source)===JSON.stringify(model)){console.log('Service cards already aligned');return}
 await prisma.$transaction(async tx=>{
  const latest=await tx.websiteVersion.findFirstOrThrow({where:{projectId},orderBy:{version:'desc'}})
  assert.equal(latest.id,saved.id,'Draft changed; retry from the latest draft')
  for(const page of model.pages)await tx.page.updateMany({where:{projectId,path:page.path},data:{sections:JSON.parse(JSON.stringify(page.sections))}})
  await tx.websiteVersion.create({data:{projectId,version:latest.version+1,kind:'DRAFT',schemaVersion:model.schemaVersion,model:JSON.parse(JSON.stringify(model)),note:'Align service card names and relevant existing imagery across pages'}})
 })
 console.log(`Saved draft ${saved.version+1}; existing uploaded photos and previous drafts retained`)
}
main().finally(()=>prisma.$disconnect())
