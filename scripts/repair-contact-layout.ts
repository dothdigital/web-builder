import 'dotenv/config'
import assert from 'node:assert/strict'
import {prisma} from '@awb/database'
import {ensureContactPageLayout,validateSectionProps} from '@awb/component-registry'
import {websiteModelSchema,validateWebsiteModel} from '@awb/website-model'

async function main(){
  const projectId=process.argv[2]
  assert.ok(projectId,'Provide a project ID')
  const latest=await prisma.websiteVersion.findFirstOrThrow({where:{projectId,kind:'DRAFT'},orderBy:{version:'desc'}})
  const source=websiteModelSchema.parse(latest.model)
  const model=websiteModelSchema.parse(ensureContactPageLayout(source))
  if(JSON.stringify(model)===JSON.stringify(source)){console.log('Contact page already uses a combined layout, or contains manual layout edits');return}
  assert.ok(validateWebsiteModel(model).valid)
  for(const page of model.pages) for(const section of page.sections) assert.ok(validateSectionProps(section.id,section.componentId,section.props).ok,section.componentId)
  await prisma.$transaction(async tx=>{
    const current=await tx.websiteVersion.findFirstOrThrow({where:{projectId},orderBy:{version:'desc'}})
    assert.equal(current.id,latest.id,'The draft changed; rerun against the latest version')
    for(const page of model.pages.filter(page=>/^\/(contact|contact-us|contactus|request-a-quote|quote)$/.test(page.path))) await tx.page.updateMany({where:{projectId,path:page.path},data:{sections:JSON.parse(JSON.stringify(page.sections))}})
    await tx.websiteVersion.create({data:{projectId,version:current.version+1,kind:'DRAFT',schemaVersion:model.schemaVersion,model:JSON.parse(JSON.stringify(model)),note:'Combine contact details and enquiry form in a two-column layout without unrelated images'}})
  })
  console.log(`Saved contact layout in draft ${latest.version+1}; previous drafts retained`)
}
main().finally(()=>prisma.$disconnect())
