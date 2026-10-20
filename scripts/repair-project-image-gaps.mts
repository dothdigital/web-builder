import React from 'react'
import 'dotenv/config'
import {writeFileSync} from 'node:fs'
Object.assign(globalThis,{React})
const {prisma}=await import('@awb/database')
const {websiteModelSchema,assertDistinctPageImages}=await import('@awb/website-model')
const {validateSectionProps}=await import('@awb/component-registry')
const {withHostingLock}=await import('../apps/web/src/lib/hosting/service')
const {deployPreview}=await import('../apps/web/src/lib/hosting/preview')
const id='cmveaqdzq003awhpa0cwv4dxt'
try {
 const version=await prisma.websiteVersion.findFirstOrThrow({where:{projectId:id,kind:'DRAFT'},orderBy:{version:'desc'}})
 const site=await prisma.hostingSite.findUniqueOrThrow({where:{projectId:id}})
 if(site.previewPendingReleaseId)throw Error('Pending deployment exists')
 writeFileSync('/tmp/webtummy-images-before.json',JSON.stringify({version,site}))
 const model=websiteModelSchema.parse(version.model)
 const source=(path:string)=>{const page=model.pages.find(p=>p.path===path)!;const s=page.sections.find(s=>s.componentId==='HeroEditorial')!;return {url:s.props.imageUrl as string,alt:s.props.imageAlt as string||s.props.heading as string}}
 const insurance=source('/insurance'), savings=source('/savings-plans'),contact=source('/contact')
 const biography=model.pages.find(p=>p.path==='/about')!.sections.find(s=>s.id==='biography')!.props
 const changes:any[]=[]
 const choose=(text:string,fallback:any)=>{
  const t=text.toLowerCase()
  const match=model.pages.find(p=>p.path.split('/').length===3 && t.includes(p.path.split('/').pop()!.replaceAll('-',' ')))
  if(match)return source(match.path)
  if(/registered|savings|financial future/.test(t))return savings
  if(/visitor|travel/.test(t))return source('/insurance/travel-insurance')
  if(/life and health|life.*protection/.test(t))return source('/insurance/life-insurance')
  if(/province|serving|advisor.area/.test(t))return {url:biography.imageUrl,alt:biography.imageAlt}
  return fallback
 }
 for(const p of model.pages){const fallback=source(p.path);for(const s of p.sections){const props=s.props as any
  if(['AboutSplitOverlap','ContactSplit'].includes(s.componentId)&&!props.imageUrl){const image=s.componentId==='ContactSplit'?contact:choose(s.id+' '+props.heading,p.path==='/'||p.path==='/about'?insurance:fallback);props.imageUrl=image.url;props.imageAlt=image.alt;changes.push([p.path,s.id,'imageUrl'])}
  if(Array.isArray(props.items))for(const [i,item]of props.items.entries())if('imageUrl'in item&&!item.imageUrl){const image=choose(item.title+' '+(item.href||'').replaceAll('-',' '),p.path==='/savings-plans'?savings:insurance);item.imageUrl=image.url;item.imageAlt=image.alt;changes.push([p.path,s.id,i])}
  if(!validateSectionProps(s.id,s.componentId,props).ok)throw Error('Invalid section '+s.id)
 }}
 assertDistinctPageImages(model)
 websiteModelSchema.parse(model)
 const owner=await prisma.workspaceMember.findFirstOrThrow({where:{workspaceId:(await prisma.project.findUniqueOrThrow({where:{id}})).workspaceId,role:'OWNER'}})
 const saved=await prisma.$transaction(async tx=>{const latest=await tx.websiteVersion.findFirstOrThrow({where:{projectId:id},orderBy:{version:'desc'}});if(latest.id!==version.id)throw Error('Draft changed during repair');return tx.websiteVersion.create({data:{projectId:id,version:latest.version+1,kind:'DRAFT',model:model as any,schemaVersion:version.schemaVersion,createdById:owner.userId,note:'Fill empty section and service-card image fields using existing project images'}})})
 console.log(JSON.stringify({version:saved.version,filled:changes.length,changes}))
 console.log(JSON.stringify(await withHostingLock(id,()=>deployPreview(id,owner.userId,saved.id))))
}finally{await prisma.$disconnect()}
