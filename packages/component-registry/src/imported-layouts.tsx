import { createElement, type CSSProperties, type ReactNode } from 'react'
import { z } from 'zod'
import data from './imported/layouts.json'
import type { ComponentDefinition, ComponentFamily, EditorField, RenderContext } from './types'
import { elementColor } from './element-colors'
import { contactPropsSchema, renderContactForm } from './components/conversion'

type Slot = { slot: string }
type Tree = string | Slot | { kind: string; attrs?: Record<string, unknown> } | { tag: string; attrs: Record<string, unknown>; children: Tree[] }
type ImportedSection = { componentId: string; theme: string; family: string; name: string; bodyClass?:string; fields: EditorField[]; fixture: Record<string, string>; tree: Tree }
const sections = data.sections as unknown as ImportedSection[]
export const importedTemplates = data.templates
export const getLayoutTemplate = (id: string | undefined) => importedTemplates.find(template => template.id === id)
export const importedSection = (id: string) => sections.find(section => section.componentId === id)
export function templatePageComponents(id: string, pagePath: string): string[] {
  const template = getLayoutTemplate(id)
  if (!template) return []
  const candidates = pagePath === '/' ? template.home : pagePath === '/contact' || /quote|contact/.test(pagePath) ? template.secondary.contact : pagePath === '/services' ? template.secondary.services : pagePath.startsWith('/services/') ? template.secondary.service : template.secondary.about
  return candidates.filter(componentId => !['HEADER', 'FOOTER'].includes(importedSection(componentId)?.family || ''))
}
export function templateGenerationComponents(id: string, pagePath: string, reviews = false): string[] {
  return templatePageComponents(id, pagePath).filter(componentId => {
    const section = importedSection(componentId)!
    return !['CREDENTIALS','TEAM','PORTFOLIO','PRICING'].includes(section.family) && (reviews || section.family !== 'REVIEWS') && !/blog/i.test(section.name + JSON.stringify(section.tree).slice(0,300))
  })
}
export function initialTemplateProps(id: string): Record<string, unknown> {
  const section = importedSection(id)!
  return Object.fromEntries(section.fields.map(field => {
    const sample = section.fixture[field.path.slice(1)] || ''
    return [field.path.slice(1), field.type === 'link' ? /^(mailto:|tel:|https?:)/.test(sample) ? '#' : sample : '']
  }))
}
export function templateChromeProps(id: string, input: { businessName:string; description:string; email?:string; phone?:string; address?:string; items:Array<{label:string;href:string;children?:Array<{label:string;href:string}>}> }) {
  const section = importedSection(id)!
  const props = initialTemplateProps(id)
  for (const field of section.fields) {
    const key=field.path.slice(1), sample=section.fixture[key] || ''
    if (field.type === 'link') {
      if(sample.startsWith('mailto:')) props[key]=input.email?`mailto:${input.email}`:'#'
      if(sample.startsWith('tel:')) props[key]=input.phone?`tel:${input.phone}`:'#'
    } else if(field.type==='text' || field.type==='textarea') {
      props[key] = /@/.test(sample) ? input.email || '' : /\d[\d ()+-]{5,}/.test(sample) ? input.phone || '' : /copyright|all rights reserved/i.test(sample) ? `© ${new Date().getFullYear()} ${input.businessName}` : /insurigo|finbiz/i.test(sample) ? input.businessName : /quick links|useful links|our services|navigation|contact us|about us|follow us|information/i.test(sample) ? sample : /get (a |free )?quote|let.s talk|contact|enquir/i.test(sample) ? 'Get in touch' : ''
    }
  }
  return {...props,logoText:input.businessName,businessName:input.businessName,tagline:input.description.slice(0,160),items:input.items}
}
export function layoutTheme(componentId: string): string | undefined { return importedSection(componentId)?.theme }
export function setTemplateHeading(componentId:string,props:Record<string,unknown>,heading:string){
  const fields=importedSection(componentId)?.fields.filter(field=>field.headingLevel===1) || []
  const words=heading.trim().split(/\s+/)
  const sizes=fields.map(field=>(importedSection(componentId)!.fixture[field.path.slice(1)] || '').trim().split(/\s+/).length)
  const total=sizes.reduce((a,b)=>a+b,0);let start=0
  fields.forEach((field,index)=>{const end=index===fields.length-1?words.length:Math.min(words.length,start+Math.max(1,Math.round(words.length*sizes[index]!/total)));props[field.path.slice(1)]=words.slice(start,end).join(' ');start=end})
}

const safeLink = (value: string) => /^(?:https?:\/\/|mailto:|tel:|\/[^/]|\/$|#)/i.test(value) ? value : '#'
function route(value: string, context: RenderContext) { return value.startsWith('/') && !value.startsWith('//') ? `${context.baseUrl}${value}` : safeLink(value) }

function renderTree(tree: Tree, values: Record<string, unknown>, context: RenderContext, family: string, key = 'root'): ReactNode {
  if (typeof tree === 'string') return tree
  if ('slot' in tree) {
    const value = String(values[tree.slot] ?? '')
    return value ? createElement('span', { key, 'data-awb-element': `/${tree.slot}`, style: elementColor(values, `/${tree.slot}`) }, value) : null
  }
  if ('kind' in tree) {
    if (tree.kind === 'logo') return createElement('span', { key, className: 'wt-layout-logo' }, values.logoImageUrl ? createElement('img', { src: String(values.logoImageUrl), alt: String(values.logoText || values.businessName || ''), 'data-awb-element': '/logoImageUrl' }) : createElement('span', { 'data-awb-element': '/logoText', style: elementColor(values, '/logoText') }, String(values.logoText || values.businessName || '')))
    if (tree.kind === 'menu') {
      const items = (values.items || []) as Array<{ label: string; href: string; children?: Array<{ label: string; href: string }> }>
      return createElement('ul', { ...tree.attrs, key }, items.map((item, index) => createElement('li', { key: index }, createElement('a', { href: route(item.href, context), 'data-awb-element': `/items/${index}/label` }, item.label), item.children?.length ? createElement('ul', { className: 'sub-menu submenu' }, item.children.map((child, j) => createElement('li', { key: j }, createElement('a', { href: route(child.href, context) }, child.label)))) : null)))
    }
    if (tree.kind === 'form') return renderContactForm(contactPropsSchema.parse({ heading: '', formFields: [ { name:'name',label:'Name',type:'text',required:true }, { name:'email',label:'Email',type:'email',required:true }, { name:'phone',label:'Phone',type:'tel' }, { name:'message',label:'Message',type:'textarea',required:true } ], submitLabel: values.submitLabel || 'Send enquiry' }), context)
    return null
  }
  const attrs: Record<string, unknown> = { ...tree.attrs, key }
  if (attrs.style && typeof attrs.style==='object') {
    const style={...attrs.style as Record<string,unknown>}
    const background=style.backgroundImage
    if(background && typeof background==='object' && 'imageSlot' in background){
      const slot=String(background.imageSlot),url=String(values[slot] || '')
      style.backgroundImage=url ? `url("${url.replaceAll('"','%22').replaceAll('\\','%5c')}")` : 'none'
      attrs['data-awb-element']=`/${slot}`
    }
    attrs.style=style
  }
  for (const [name, value] of Object.entries(attrs)) {
    if (value && typeof value === 'object' && 'slot' in value) {
      const slot = String((value as Slot).slot)
      const resolved = String(values[slot] ?? '')
      attrs[name] = name === 'href' ? route(resolved, context) : resolved
      if (name === 'src') { attrs['data-awb-element'] = `/${slot}`; attrs.style = { ...(attrs.style as CSSProperties), ...elementColor(values, `/${slot}`) } }
      if (name === 'href') attrs['data-awb-link'] = `/${slot}`
    }
  }
  if (tree.tag === 'img') {
    if (!attrs.src) return context.editing ? createElement('div', { key, 'data-awb-element': attrs['data-awb-element'], style:{ minHeight:160,background:'var(--awb-surface)',border:'1px dashed var(--awb-border)',padding:24 } }, 'Choose an image') : null
    attrs.loading = 'lazy'; attrs.alt = values.imageAlt || attrs.alt || ''
  }
  if (typeof attrs.className === 'string' && attrs.className.includes('swiper') && !attrs.className.includes('wrapper') && family !== 'HERO') attrs['data-layout-carousel'] = true
  // A template may contain a video or iframe placeholder; never run demo embeds.
  if (['input','img','br','hr','meta','source','path','circle','use'].includes(tree.tag)) return createElement(tree.tag, attrs)
  return createElement(tree.tag, attrs, ...tree.children.map((child, index) => renderTree(child, values, context, family, `${key}-${index}`)))
}

const menuSchema = z.array(z.object({ label:z.string(),href:z.string(),children:z.array(z.object({label:z.string(),href:z.string()})).default([]) })).default([])
export const importedLayoutDefinitions: ComponentDefinition[] = sections.map(section => {
  const shape: Record<string, z.ZodType> = Object.fromEntries(section.fields.map(field => [field.path.slice(1), z.string().max(field.type === 'textarea' ? 12000 : 3000).default('')]))
  shape.imageAlt = z.string().default('')
  shape.submitLabel = z.string().default('Send enquiry')
  if (['HEADER','FOOTER'].includes(section.family)) { shape.logoText=z.string().default('');shape.businessName=z.string().default('');shape.logoImageUrl=z.string().default('');shape.items=menuSchema;shape.sticky=z.boolean().default(false) }
  return {
    componentId:section.componentId,version:'1.0.0',family:section.family as ComponentFamily,name:section.name,
    description:`Imported ${section.theme} layout section. Preserve its structure and replace demonstration copy with supplied business content.`,
    aiGuidance:'Use only when its template is selected. Fill all text slots with relevant supplied facts; omit unsupported claims and keep image slots empty for generation. Preserve the original section order.',
    propsSchema:z.object(shape),editorFields:[...section.fields,{path:'/imageAlt',label:'Image description',type:'text'},...(section.family==='HEADER'?[{path:'/logoText',label:'Business name',type:'text' as const},{path:'/logoImageUrl',label:'Logo',type:'image' as const},{path:'/items',label:'Navigation',type:'list' as const}]:[])],tokenDeps:[],fixture:section.fixture,
    render:({props,context}) => createElement('div',{className:`wt-layout-${section.theme} ${section.bodyClass || ''}`,style:{position:'relative'}},createElement('link',{rel:'stylesheet',href:`/template-library/${section.theme}/editable.css`,precedence:`layout-${section.theme}`}),renderTree(section.tree,props as Record<string,unknown>,context,section.family),section.family==='HEADER'?createElement('details',{className:'wt-layout-mobile-menu'},createElement('summary',{},'Menu'),renderTree({kind:'menu'},props as Record<string,unknown>,context,section.family)):null),
  }
})

export function templateCopyCatalogue(ids: string[]) {
  return ids.flatMap(id => {
    const section = importedSection(id)
    if(!section)return []
    return { componentId:id,family:section.family,fields:section.fields.filter(field=>field.type!=='link' && field.type!=='image'),exampleProps:Object.fromEntries(section.fields.filter(field=>!['link','image'].includes(field.type)).map(field=>[field.path.slice(1),section.fixture[field.path.slice(1)]])) }
  })
}
