import 'dotenv/config'
import assert from 'node:assert/strict'
import {readFile,writeFile} from 'node:fs/promises'
import {prisma} from '@awb/database'
import {websiteModelSchema,validateWebsiteModel} from '@awb/website-model'
import {enrichServiceDetailPages} from '../packages/pipeline/src/content-generation'

async function main() {
  const projectId=process.argv[2]
  assert.ok(projectId,'Provide a project ID')
  const filename=`/tmp/awb-service-content-${projectId}.json`
  if (process.argv.includes('--apply')) {
    const staged=JSON.parse(await readFile(filename,'utf8'))
    const model=websiteModelSchema.parse(staged.model)
    assert.ok(validateWebsiteModel(model).valid)
    await prisma.$transaction(async tx=>{
      const current=await tx.websiteVersion.findFirstOrThrow({where:{projectId},orderBy:{version:'desc'}})
      assert.equal(current.id,staged.sourceVersionId,'Draft changed while content was generated; regenerate from the latest draft')
      for (const page of model.pages.filter(page=>page.sections.some(section=>section.componentId==='ServiceDetail'))) {
        await tx.page.updateMany({where:{projectId,path:page.path},data:{title:page.title,seoTitle:page.seo.title,seoDescription:page.seo.description,sections:JSON.parse(JSON.stringify(page.sections))}})
      }
      await tx.websiteVersion.create({data:{projectId,version:current.version+1,kind:'DRAFT',schemaVersion:model.schemaVersion,model:JSON.parse(JSON.stringify(model)),note:'Complete service topics and FAQs using supplied business facts'}})
    })
    console.log('Saved complete service content in a new draft; previous versions retained')
    return
  }
  const latest=await prisma.websiteVersion.findFirstOrThrow({where:{projectId,kind:'DRAFT'},orderBy:{version:'desc'}})
  const source=websiteModelSchema.parse(latest.model)
  const model=await enrichServiceDetailPages(projectId,source,path=>console.log(`Generating complete content: ${path}`))
  assert.ok(validateWebsiteModel(model).valid)
  await writeFile(filename,JSON.stringify({sourceVersionId:latest.id,model},null,2))
  for (const page of model.pages) {
    const detail=page.sections.find(section=>section.componentId==='ServiceDetail')
    if (!detail) continue
    console.log(JSON.stringify({path:page.path,words:JSON.stringify(detail.props).split(/\s+/).length,topics:(detail.props.contentBlocks as unknown[]).length,faqs:(detail.props.faqs as unknown[]).length}))
  }
  console.log(`Staged generated content at ${filename}`)
}
main().finally(()=>prisma.$disconnect())
