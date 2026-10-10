import type {WebsiteModel} from '@awb/website-model'
import {templateServiceCards} from './imported-layouts'
export function alignTemplateServiceCards(source:WebsiteModel,options:{reuseHomeImages?:boolean;replaceableImages?:Set<string>}={}):WebsiteModel {
 const model=structuredClone(source)
 const services=model.pages.filter(page=>page.path.startsWith('/services/'))
 const match=(label:string)=>services.find(page=>(page.navLabel||page.title).toLowerCase()===label.toLowerCase())??services.find(page=>label.toLowerCase().includes((page.navLabel||page.title).toLowerCase()))
 const homeImages=new Map<string,string>()
 const home=model.pages.find(page=>page.path==='/')
 for(const section of home?.sections||[]) for(const card of templateServiceCards(section.componentId,section.props)) {
  const service=match(card.label)
  const image=card.imagePath?section.props[card.imagePath.slice(1)]:undefined
  if(service&&typeof image==='string'&&image)homeImages.set(service.path,image)
 }
 for(const page of model.pages)for(const section of page.sections)for(const card of templateServiceCards(section.componentId,section.props)) {
  const service=match(card.label)
  if(!service)continue
  if(card.titlePath)section.props[card.titlePath.slice(1)]=service.navLabel||service.title
  if(!options.reuseHomeImages||page.path==='/'||!card.imagePath)continue
  const image=homeImages.get(service.path)
  const field=card.imagePath.slice(1)
  const current=section.props[field]
  if(image&&(!current||!options.replaceableImages||options.replaceableImages.has(String(current))))section.props[field]=image
 }
 return model
}
