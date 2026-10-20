import { z } from 'zod'
import { pagePathFromName } from './page-address'
import { websiteModelSchema, type WebsiteModel, type WebsitePage } from '@awb/website-model'
export const copyPageRequestSchema=z.object({
 title:z.string().trim().min(1,'Enter a page name.').max(200),
 path:z.string().trim().max(200).regex(/^\/[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)*$/,'Enter a page URL such as /about-copy.'),
 addToNavigation:z.boolean().default(true),
})
export type CopyPageRequest=z.infer<typeof copyPageRequestSchema>
export function suggestPageCopy(model:WebsiteModel,page:WebsitePage):CopyPageRequest{
 const title=`${page.title.slice(0,193)} (copy)`
 return {title,path:pagePathFromName(model,title),addToNavigation:true}
}
export function copyWebsitePage(model:WebsiteModel,sourceId:string,raw:unknown,id:string){
 const request=copyPageRequestSchema.parse(raw)
 const source=model.pages.find(page=>page.id===sourceId)
 if(!source)throw new Error('The original page no longer exists.')
 if(model.pages.some(page=>page.id===id||page.path===request.path))throw new Error('That page address already exists. Choose another URL.')
 const page=structuredClone(source)
 const sectionIds=new Map(page.sections.map((section,index)=>[section.id,`${id}-section-${index}`]))
 const rewrite=(value:unknown,key=''):unknown=>{
  if(typeof value==='string'&&key==='href'){
   if(value===source.path)return request.path
   if(value.startsWith('#'))return '#'+(sectionIds.get(value.slice(1))??value.slice(1))
   if(value.startsWith(source.path+'#')){const anchor=value.slice(source.path.length+1);return `${request.path}#${sectionIds.get(anchor)??anchor}`}
  }
  if(Array.isArray(value))return value.map(item=>rewrite(item,key))
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([name,child])=>[name,rewrite(child,name)]))
  return value
 }
 page.id=id;page.path=request.path;page.title=request.title;page.navLabel=request.title
 page.seo={...page.seo,title:request.title,canonical:request.path}
 page.sections=page.sections.map(section=>({...section,id:sectionIds.get(section.id)!,props:rewrite(section.props) as Record<string,unknown>}))
 let next:WebsiteModel={...model,pages:[...model.pages,page]}
 if(request.addToNavigation){
  const header=model.globalComponents.header
  next={...next,globalComponents:{...model.globalComponents,header:{...header,props:{...header.props,items:[...(Array.isArray(header.props.items)?header.props.items:[]),{label:request.title,href:request.path,children:[]}]}}},navigation:{...model.navigation,primaryMenu:[...model.navigation.primaryMenu,{label:request.title,linkType:'PAGE',pageId:id,newTab:false,children:[]}]}}
 }
 return {model:websiteModelSchema.parse(next),pageId:id}
}
