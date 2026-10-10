import type { WebsiteModel } from '@awb/website-model'
import { templateServiceCards } from './imported-layouts'

// Older imported templates only produced an overview. Derive real detail
// routes from its saved service copy without changing existing page layouts.
export function ensureServiceDetailPages(source: WebsiteModel): WebsiteModel {
  const overview = source.pages.find(page=>page.path==='/services')
  if (!overview) return source
  const cards = overview.sections.filter(section=>!section.hidden).flatMap(section=>Array.isArray(section.props.items)
    ? (section.props.items as Array<{title?:string;description?:string;href?:string}>).filter(item=>item.title&&item.description).map(item=>({label:item.title!,description:item.description!,href:item.href!==overview.path&&source.pages.some(page=>page.path===item.href&&(page.pageType==='SERVICE'||page.title.toLowerCase()===item.title!.toLowerCase()))?item.href!:`/services/${item.title!.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')}`}))
    : templateServiceCards(section.componentId,section.props))
  const unique = [...new Map(cards.filter(card=>card.description).map(card=>[card.href,card])).values()]
  if (!unique.length) return source
  const pages = [...source.pages]
  const hero = overview.sections.find(section=>!section.hidden&&section.props.heading)
  const contactHref = source.pages.find(page=>/\/(contact|contact-us|request-a-quote|quote)$/.test(page.path))?.path || '/contact'
  const links = unique.map(card=>({label:card.label,href:source.pages.find(page=>page.path.startsWith('/services/')&&(page.title.toLowerCase()===card.label.toLowerCase()||page.navLabel?.toLowerCase()===card.label.toLowerCase()))?.path || card.href}))
  for (const card of unique) {
    const path = links.find(link=>link.label===card.label)!.href
    if (pages.some(page=>page.path===path)) continue
    const slug = path.split('/').pop()!
    pages.push({
      id:`service-page-${slug}`,path,title:card.label,navLabel:card.label,pageType:'SERVICE',h1:card.label,
      seo:{title:`${card.label} | ${source.site.name}`.slice(0,200),description:card.description.slice(0,160),index:true},
      sections:[
        hero ? {...hero,id:`${slug}-hero`,props:{...hero.props,heading:card.label,text3:card.label,link1:path}}
          : {id:`${slug}-hero`,componentId:'HeroTypographic',componentVersion:'1.0.0',hidden:false,props:{heading:card.label}},
        {id:`${slug}-details`,componentId:'ServiceDetail',componentVersion:'1.0.0',hidden:false,props:{heading:`About ${card.label}`,body:card.description,contactHref,related:links.filter(link=>link.href!==path)}},
      ],
    })
  }
  const items = (source.globalComponents.header.props.items || []) as Array<{label:string;href:string;children?:Array<{label:string;href:string}>}>
  const headerItems = items.map(item=>item.href==='/services'?{...item,children:links}:item)
  const linkedPages = pages.map(page=>page.id===overview.id&&page.sections.some(section=>Array.isArray(section.props.items))?{...page,sections:page.sections.map(section=>Array.isArray(section.props.items)?{...section,props:{...section.props,items:(section.props.items as Array<{title:string}>).map(item=>({...item,href:links.find(link=>link.label===item.title)?.href}))}}:section)}:page)
  return {...source,pages:linkedPages,globalComponents:{...source.globalComponents,header:{...source.globalComponents.header,props:{...source.globalComponents.header.props,items:headerItems}}},navigation:{...source.navigation,primaryMenu:source.navigation.primaryMenu.map(item=>item.pageId===overview.id?{...item,children:links.map(link=>({label:link.label,linkType:'PAGE' as const,pageId:pages.find(page=>page.path===link.href)!.id,newTab:false,children:[]}))}:item)}}
}
