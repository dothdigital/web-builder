import {config} from 'dotenv'
config({path:'.env',quiet:true})
import {writeFile} from 'node:fs/promises'
import {websiteModelSchema} from '@awb/website-model'
import {resolveSectionMedia} from '../apps/web/src/lib/section-media'
const {prisma}=await import('@awb/database')
try {
 const projectId='cmveaqdzq003awhpa0cwv4dxt'
 const version=await prisma.websiteVersion.findFirstOrThrow({where:{projectId,kind:'DRAFT'},orderBy:{version:'desc'}})
 const model=websiteModelSchema.parse(version.model)
 const assets=await prisma.asset.findMany({where:{projectId,kind:'IMAGE'},select:{id:true,url:true,source:true,altText:true,prompt:true,createdAt:true}})
 const pages=model.pages.map(page=>{
  const images:Array<{section:string;component:string;field:string;url:string;alt:unknown;renderOnly:boolean}>=[]
  const walk=(value:unknown,path:string,section:any,original:any)=>{
   if(!value||typeof value!=='object')return
   for(const [key,child] of Object.entries(value)){
    if(typeof child==='string'&& /^(imageUrl|backgroundImageUrl|src|url)$/.test(key)&& /^(https?:|\/uploads\/|data:image)/.test(child)) images.push({section:section.id,component:section.componentId,field:path+'/'+key,url:child,alt:(value as any).imageAlt??(value as any).alt,renderOnly:JSON.stringify(original).indexOf(child)===-1})
    else if(child&&typeof child==='object')walk(child,path+'/'+key,section,original)
   }
  }
  for(const section of page.sections.filter(s=>!s.hidden))walk(resolveSectionMedia(model,page,section),'',section,section.props)
  const repeated=Object.entries(Object.groupBy(images,image=>image.url)).filter(([,uses])=>uses!.length>1).map(([url,uses])=>({url,uses}))
  return {path:page.path,title:page.title,images,repeated}
 })
 const report={version:version.version,createdAt:version.createdAt,pages,assets}
 await writeFile('/tmp/webtummy-project-image-repeats.json',JSON.stringify(report,null,2))
 console.log(JSON.stringify({version:version.version,pages:pages.map(page=>({path:page.path,imageCount:page.images.length,distinctImages:new Set(page.images.map(i=>i.url)).size,repeated:page.repeated.map(group=>({url:group.url,uses:group.uses?.map(i=>({section:i.section,component:i.component,field:i.field,alt:i.alt,renderOnly:i.renderOnly}))}))})),assetCount:assets.length},null,2))
} finally { await prisma.$disconnect() }
