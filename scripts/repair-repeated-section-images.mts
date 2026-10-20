import {config} from 'dotenv'
config({path:'.env',quiet:true})
import {createHash} from 'node:crypto'
import {writeFile} from 'node:fs/promises'
import {websiteModelSchema,repeatedPageImages,assertDistinctPageImages} from '@awb/website-model'
import {createAiProvider} from '@awb/ai'
import {assetKey,getStorage} from '@awb/shared'
import {getAtPointer} from '../packages/pipeline/src/json-pointer'
import {replaceScopedImage} from '../packages/pipeline/src/scoped-rerun'
const {prisma}=await import('@awb/database')
const projectId=process.argv[2]
if(!projectId)throw new Error('Usage: repair-repeated-section-images PROJECT_ID')
try{
 const project=await prisma.project.findUniqueOrThrow({where:{id:projectId},include:{businessProfile:true}})
 const version=await prisma.websiteVersion.findFirstOrThrow({where:{projectId,kind:'DRAFT'},orderBy:{version:'desc'}})
 const model=websiteModelSchema.parse(version.model)
 const targets=repeatedPageImages(model).flatMap(group=>group.uses.slice(1))
 if(!targets.length){console.log('No repeated content images.');process.exitCode=0}else{
  await writeFile(`/tmp/${projectId}-before-image-repair.json`,JSON.stringify(version),{mode:0o600})
  const provider=createAiProvider()
  if(provider.name!=='openai')throw new Error('Real image provider required')
  const brief={businessName:project.businessProfile?.displayName??project.name,description:project.businessProfile?.description??'',services:[],goals:[],tonePreferences:[],answers:{},hasLogo:true,logoColors:[],uploadedImageUrls:[],testimonials:[]}
  const slots=targets.map(use=>{
   const page=model.pages.find(page=>page.id===use.pageId)!
   const section=page.sections.find(section=>section.id===use.sectionId)!
   return {slot:`${use.pageId}:${use.sectionId}:${use.pointer}`,pageTitle:page.title,componentId:section.componentId,family:'ABOUT',heading:String(section.props.heading??page.title),subjectContext:JSON.stringify({section:section.props,instructions:'Replace a repeated hero image with a DISTINCT section-specific concept. Show the purpose of this exact section. Do not repeat the existing hero composition. Keep the existing forest green, sage, cream and restrained gold editorial style. No text, logos or invented real staff.'})}
  })
  console.log(`Planning ${slots.length} distinct replacement images across ${new Set(targets.map(target=>target.pagePath)).size} pages.`)
  const {data:plan}=await provider.planImages(brief,model,slots)
  const updates:Array<{use:typeof targets[number];url:string;alt:string}>=[]
  for(let offset=0;offset<targets.length;offset+=2){
   const batch=await Promise.allSettled(targets.slice(offset,offset+2).map(async use=>{
    const slot=`${use.pageId}:${use.sectionId}:${use.pointer}`
    const imagePlan=plan.images.find(image=>image.slot===slot)
    if(!imagePlan)throw new Error(`Image plan omitted ${slot}`)
    const assetId='distinct-'+createHash('sha256').update(`${projectId}:${slot}:${use.url}`).digest('hex').slice(0,32)
    let asset=await prisma.asset.findUnique({where:{id:assetId}})
    if(!asset){
     console.log(`Generating ${use.pagePath} · ${use.sectionId}`)
     const {data:image}=await provider.generateImage(`${imagePlan.prompt}\nCreate distinct artwork for this section rather than reusing its page hero. No text, labels or logos.`,imagePlan.aspectRatio,slot,imagePlan.alt)
     const stored=await getStorage().put(assetKey(project.workspaceId,projectId,`${assetId}.png`),image.data,image.contentType)
     asset=await prisma.asset.create({data:{id:assetId,projectId,workspaceId:project.workspaceId,kind:'IMAGE',source:'AI_GENERATED',storageKey:stored.key,url:stored.url,mimeType:stored.contentType,bytes:stored.bytes,altText:image.alt,prompt:image.prompt}})
    }
    console.log(`Ready ${use.pagePath} · ${use.sectionId}`)
    return {use,url:asset.url,alt:asset.altText??imagePlan.alt}
   }))
   for(const result of batch){if(result.status==='fulfilled')updates.push(result.value);else throw result.reason}
  }
  await prisma.$transaction(async tx=>{
   await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${projectId}))`
   const latest=await tx.websiteVersion.findFirstOrThrow({where:{projectId,kind:'DRAFT'},orderBy:{version:'desc'}})
   let current=websiteModelSchema.parse(latest.model)
   for(const update of updates){
    const page=current.pages.find(page=>page.id===update.use.pageId)
    const section=page?.sections.find(section=>section.id===update.use.sectionId)
    if(!section||getAtPointer(section.props,update.use.pointer)!==update.use.url)throw new Error('An image was edited during repair. Generated assets are retained; saved draft was not overwritten.')
    current=replaceScopedImage(current,`${update.use.pageId}:${update.use.sectionId}:${update.use.pointer}`,update.url,update.alt)
   }
   assertDistinctPageImages(current)
   const valid=websiteModelSchema.parse(current)
   const last=await tx.websiteVersion.findFirstOrThrow({where:{projectId},orderBy:{version:'desc'}})
   const saved=await tx.websiteVersion.create({data:{projectId,version:last.version+1,kind:'DRAFT',schemaVersion:valid.schemaVersion,model:JSON.parse(JSON.stringify(valid)),note:`Replace ${updates.length} repeated content images with distinct section-specific artwork`}})
   for(const path of new Set(updates.map(update=>update.use.pagePath))){const page=valid.pages.find(page=>page.path===path)!;await tx.page.updateMany({where:{projectId,path},data:{sections:JSON.parse(JSON.stringify(page.sections))}})}
   console.log(JSON.stringify({savedVersion:saved.version,replaced:updates.length,remainingRepeatedImages:repeatedPageImages(valid).length}))
  },{isolationLevel:'Serializable',timeout:30000})
 }
}finally{await prisma.$disconnect()}
