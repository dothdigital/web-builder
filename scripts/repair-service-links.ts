import 'dotenv/config'
import assert from 'node:assert/strict'
import { prisma } from '@awb/database'
import { ensureServiceDetailPages, validateSectionProps } from '@awb/component-registry'
import { websiteModelSchema, validateWebsiteModel } from '@awb/website-model'

async function main() {
  const projectId = process.argv[2]
  assert.ok(projectId,'Provide a project ID')
  const latest = await prisma.websiteVersion.findFirstOrThrow({where:{projectId,kind:'DRAFT'},orderBy:{version:'desc'}})
  const original = websiteModelSchema.parse(latest.model)
  const model = websiteModelSchema.parse(ensureServiceDetailPages(original))
  const added = model.pages.filter(page=>!original.pages.some(existing=>existing.path===page.path))
  if (!added.length) {console.log('Service detail pages already exist');return}
  const validation = validateWebsiteModel(model)
  assert.ok(validation.valid,JSON.stringify(validation.issues.filter(issue=>issue.level==='error')))
  for (const page of added) for (const section of page.sections) {
    assert.ok(validateSectionProps(section.id,section.componentId,section.props).ok,section.componentId)
  }
  await prisma.$transaction(async tx=>{
    const current = await tx.websiteVersion.findFirstOrThrow({where:{projectId},orderBy:{version:'desc'}})
    assert.equal(current.id,latest.id,'Draft changed during repair; rerun to use the latest version')
    const overview = await tx.page.findFirst({where:{projectId,path:'/services'}})
    await tx.page.createMany({data:added.map(page=>({projectId,parentId:overview?.id,title:page.title,navLabel:page.navLabel,slug:page.path.split('/').pop()!,path:page.path,pageType:'SERVICE' as const,status:'DRAFT' as const,position:model.pages.indexOf(page),indexable:page.seo.index,seoTitle:page.seo.title,seoDescription:page.seo.description,sections:JSON.parse(JSON.stringify(page.sections))}))})
    await tx.websiteVersion.create({data:{projectId,version:latest.version+1,kind:'DRAFT',schemaVersion:model.schemaVersion,model:JSON.parse(JSON.stringify(model)),note:'Repair service links with dedicated detail pages from saved service content'}})
  })
  console.log(`Saved ${added.length} service detail pages in a new draft; previous draft retained`)
  for (const page of added) console.log(page.path)
}
main().finally(()=>prisma.$disconnect())
