import { createElement, type CSSProperties, type ReactNode } from 'react'
import { z } from 'zod'
import data from './imported/layouts.json'
import decorativeIcons from './imported/decorative-icons.json'
import type { ComponentDefinition, ComponentFamily, EditorField, RenderContext } from './types'
import { Media } from './primitives'
import { imageSizing } from './image-sizing'
import { elementColor } from './element-colors'
import { contactPropsSchema, renderContactForm } from './components/conversion'
import { footerEditorial, footerPropsSchema } from './components/footers'
import { SiteContentContainer } from './components/site-content-container'
import { TemplateEnquiry } from './components/template-enquiry'
import { templateBrandColor, templateColorVars } from './template-colors'

type Slot = { slot: string }
type Tree = string | Slot | { kind: string; attrs?: Record<string, unknown> } | { tag: string; attrs: Record<string, unknown>; children: Tree[] }
type ImportedSection = { componentId: string; theme: string; family: string; name: string; bodyClass?:string; fields: EditorField[]; fixture: Record<string, string>; tree: Tree }
const sections = data.sections as unknown as ImportedSection[]
const iconTrees=decorativeIcons as unknown as Record<string,Tree>
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
      props[key] = /@/.test(sample) ? input.email || '' : /\d[\d ()+-]{5,}/.test(sample) ? input.phone || '' : /copyright|all rights reserved/i.test(sample) ? `© ${new Date().getFullYear()} ${input.businessName}` : /webtummy(?:-insurance|-business)?/i.test(sample) ? input.businessName : /quick links|useful links|our services|navigation|contact us|about us|follow us|information/i.test(sample) ? sample : /get (a |free )?quote|let.s talk|contact|enquir|book.*meeting/i.test(sample) ? 'Get in touch' : ''
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
function route(value: string, context: RenderContext) { if (/^\/(?:uploads|api)\//.test(value)) return safeLink(value); return value.startsWith('/') && !value.startsWith('//') ? `${context.baseUrl}${value}` : safeLink(value) }

function anchorText(tree: Tree, values: Record<string, unknown>): string {
  if (typeof tree === 'string') return tree
  if ('slot' in tree) return String(values[tree.slot] ?? '')
  return 'children' in tree ? tree.children.map(child => anchorText(child, values)).join(' ') : ''
}

function serviceCardLink(tree: Tree, values: Record<string, unknown>) {
  if (typeof tree !== 'object' || !('tag' in tree) || !/\b(service-two-inner|service-one-inner-four|rs-service__item|single-inner-service-ten)\b/.test(String(tree.attrs.className || ''))) return undefined
  function heading(node: Tree): string {
    if (typeof node !== 'object' || !('tag' in node)) return ''
    if (/^h[3-5]$/.test(node.tag)) return anchorText(node, values).trim()
    return node.children.map(heading).find(Boolean) || ''
  }
  const label = heading(tree)
  return label ? { label, href:`/services/${label.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')}` } : undefined
}

export function templateServiceLinks(componentId: string, props: Record<string, unknown>) {
  const links: Array<{ label:string;href:string }> = []
  function walk(tree: Tree) {
    const link = serviceCardLink(tree, props)
    if (link) links.push(link)
    else if (typeof tree === 'object' && 'children' in tree) tree.children.forEach(walk)
  }
  const section = importedSection(componentId)
  if (section?.family === 'SERVICES') walk(section.tree)
  return links
}

export function templateServiceCards(componentId: string, props: Record<string, unknown>) {
  const cards: Array<{ label:string;href:string;description:string;titlePath?:string;imagePath?:string }> = []
  function description(tree: Tree): string {
    if (typeof tree !== 'object' || !('tag' in tree)) return ''
    if (tree.tag === 'p') return anchorText(tree,props).trim()
    return tree.children.map(description).filter(Boolean).join('\n\n')
  }
  function walk(tree: Tree) {
    const link = serviceCardLink(tree,props)
    if (link) {
      const heading=treeNodes(tree,node=>/^h[3-5]$/.test(node.tag))[0]
      const titleSlot=heading?.children.find(child=>typeof child==='object'&&'slot' in child) as Slot|undefined
      const imageSlot=primaryImageSlot(tree)
      cards.push({ ...link, description:description(tree),titlePath:titleSlot?`/${titleSlot.slot}`:undefined,imagePath:imageSlot?`/${imageSlot}`:undefined })
    }
    else if (typeof tree === 'object' && 'children' in tree) tree.children.forEach(walk)
  }
  const section = importedSection(componentId)
  if (section?.family === 'SERVICES') walk(section.tree)
  return cards
}

export function templateImageSubject(componentId:string,pointer:string,props:Record<string,unknown>):string|undefined {
  const card=templateServiceCards(componentId,props).find(card=>card.imagePath===pointer)
  return card?`Service card: ${card.label}. ${card.description}`:undefined
}

export function normalizeTemplateHeading(componentId:string,props:Record<string,unknown>):Record<string,unknown> {
  const section=importedSection(componentId)
  if(section?.family!=='HERO')return props
  const fields=section.fields.filter(field=>field.headingLevel===1)
  if(fields.length<2)return props
  const keys=fields.map(field=>field.path.slice(1))
  const heading=keys.map(key=>String(props[key]||'').trim()).filter(Boolean).join(' ')
  return {...props,[keys[0]!]:heading,...Object.fromEntries(keys.slice(1).map(key=>[key,'']))}
}

function placeholderLink(tree: Tree, values: Record<string, unknown>, family: string): string {
  const label = anchorText(tree, values)
  if (/contact|quote|meeting|appointment|information|enquir|conversation|talk|touch|discuss|request|book/i.test(label)) return '/contact'
  if (/learn|explore|read|more|detail/i.test(label)) return family === 'ABOUT' ? '/about' : '/services'
  if (label.trim() && /insurance|coverage|savings/i.test(label)) return '/services'
  if (label.trim() && family === 'ABOUT') return '/about'
  return '#'
}

function treeNodes(tree: Tree, match: (node: Extract<Tree, { tag: string }>) => boolean): Extract<Tree, { tag: string }>[] {
  if (typeof tree !== 'object' || !('tag' in tree)) return []
  return [...(match(tree) ? [tree] : []), ...tree.children.flatMap(child => treeNodes(child, match))]
}
function cleanTemplateNode(node: Extract<Tree,{tag:string}> | undefined, tag:string, values:Record<string,unknown>, context:RenderContext, family:string, key:string, style:CSSProperties) {
  return node ? renderTree({...node,tag,attrs:{style}},values,context,family,key) : null
}
function primaryImageSlot(tree:Tree): string | undefined {
  if (typeof tree !== 'object' || !('tag' in tree)) return undefined
  const src=tree.attrs.src
  if (tree.tag==='img' && src && typeof src==='object' && 'slot' in src) return String(src.slot)
  const background=(tree.attrs.style as {backgroundImage?:{imageSlot?:string}} | undefined)?.backgroundImage
  if (background?.imageSlot) return background.imageSlot
  return tree.children.map(primaryImageSlot).find(Boolean)
}
export function templateRequiredImagePointers(componentId:string):string[]|undefined {
  const section=importedSection(componentId)
  if(!section) return undefined
  if(treeNodes(section.tree,node=>String(node.attrs.className||'').split(/\s+/).includes('banner-tena-area')).length) {
    const photo=treeNodes(section.tree,node=>node.tag==='img' && typeof node.attrs.src==='object')[0]
    const slot=photo?primaryImageSlot(photo):'imageUrl'
    return slot?[`/${slot}`]:[]
  }
  const cards=section.family==='SERVICES'?treeNodes(section.tree,node=>/\b(single-inner-service-ten|service-one-inner-four)\b/.test(String(node.attrs.className||''))):[]
  if(cards.length) return cards.flatMap(card=>{const slot=primaryImageSlot(card);return slot?[`/${slot}`]:[]})
  return undefined
}
function renderPhotoHero(section:ImportedSection,values:Record<string,unknown>,context:RenderContext):ReactNode|undefined {
  if (!treeNodes(section.tree,node=>String(node.attrs.className||'').split(/\s+/).includes('banner-tena-area')).length) return undefined
  const heading=treeNodes(section.tree,node=>node.tag==='h1')[0]
  const eyebrow=treeNodes(section.tree,node=>String(node.attrs.className||'').includes('pre-title'))[0]
  const description=treeNodes(section.tree,node=>node.tag==='p' && String(node.attrs.className||'').includes('disc'))[0]
  const image=treeNodes(section.tree,node=>node.tag==='img' && typeof node.attrs.src==='object')[0]
  const slot=image ? primaryImageSlot(image) : 'imageUrl'
  const button=treeNodes(section.tree,node=>node.tag==='a')[0]
  const clean=(node:Extract<Tree,{tag:string}>|undefined,tag:string,key:string,style:CSSProperties)=>cleanTemplateNode(node,tag,values,context,section.family,key,style)
  return createElement('section',{className:'awb-photo-hero',style:{...templateColorVars(context.tokens),padding:'clamp(32px,5vw,64px) 0',background:'var(--awb-bg)',color:'var(--awb-fg)'}},
    createElement('style',{},'.awb-photo-hero-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);align-items:center;gap:clamp(24px,4vw,64px)}.awb-photo-hero-grid img{width:100%;object-fit:cover}.awb-photo-hero a{display:inline-flex;margin-top:24px;background:var(--awb-primary);color:var(--awb-primary-fg,#fff);padding:14px 22px;border-radius:8px;font-size:15px;font-weight:600;text-decoration:none}@media(max-width:767px){.awb-photo-hero-grid{grid-template-columns:1fr}}'),
    createElement(SiteContentContainer,{theme:context.templateTheme||section.theme,children:createElement('div',{className:'awb-photo-hero-grid'},
      createElement('div',{},clean(eyebrow,'p','hero-eyebrow',{margin:'0 0 16px',fontSize:12,fontWeight:600,letterSpacing:'.12em',textTransform:'uppercase',color:'var(--awb-primary)'}),
        clean(heading,'h1','hero-title',{margin:0,fontSize:'clamp(30px,3.5vw,50px)',fontWeight:700,lineHeight:1.15}),
        clean(description,'p','hero-description',{margin:'24px 0 0',fontSize:16,lineHeight:1.7,color:'var(--awb-muted)'}),
        button?renderTree({...button,attrs:{href:button.attrs.href}},values,context,section.family,'hero-cta'):null),
      slot&&values[slot]?createElement(Media,{src:String(values[slot]),alt:String(values.imageAlt||anchorText(heading||'',values)),ratio:'4 / 3',sizeStyle:imageSizing(values,`/${slot}`),'data-awb-element':`/${slot}`,style:{display:'block',borderRadius:16,overflow:'hidden'}}):null)}))
}
function renderServiceGrid(section:ImportedSection,values:Record<string,unknown>,context:RenderContext):ReactNode|undefined {
  if(section.family!=='SERVICES') return undefined
  const cards=treeNodes(section.tree,node=>/\b(single-inner-service-ten|service-one-inner-four)\b/.test(String(node.attrs.className||'')))
  if(!cards.length) return undefined
  const title=treeNodes(section.tree,node=>node.tag==='h2')[0]
  const eyebrow=treeNodes(section.tree,node=>String(node.attrs.className||'').includes('pre-title'))[0]
  const callout=treeNodes(section.tree,node=>String(node.attrs.className||'').split(/\s+/).includes('cta-one-inner'))[0]
  const clean=(node:Extract<Tree,{tag:string}>|undefined,tag:string,key:string,style:CSSProperties)=>cleanTemplateNode(node,tag,values,context,section.family,key,style)
  return createElement('section',{className:'awb-template-services','data-layout-family':'SERVICES',style:{...templateColorVars(context.tokens),padding:'clamp(36px,5vw,64px) 0',background:'var(--awb-bg)',color:'var(--awb-fg)'}},
    createElement('style',{},'.awb-template-services a{color:var(--awb-primary)}.awb-template-services-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:24px}.awb-template-service-card{display:flex;flex-direction:column;overflow:hidden;border:1px solid var(--awb-border);border-radius:14px;background:var(--awb-bg)}.awb-template-service-card img{width:100%;object-fit:cover}.awb-template-service-body{padding:24px;display:flex;flex-direction:column;gap:16px;flex:1}.awb-template-service-body a{margin-top:auto;color:var(--awb-primary);font-size:14px;font-weight:600;text-decoration:none}@media(max-width:991px){.awb-template-services-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:575px){.awb-template-services-grid{grid-template-columns:1fr}}'),
    createElement(SiteContentContainer,{theme:context.templateTheme||section.theme,children:createElement('div',{},
      createElement('header',{style:{marginBottom:32,maxWidth:780}},clean(eyebrow,'p','services-eyebrow',{margin:'0 0 10px',fontSize:12,fontWeight:600,letterSpacing:'.1em',textTransform:'uppercase',color:'var(--awb-primary)'}),clean(title,'h2','services-title',{margin:0,fontSize:'clamp(26px,3vw,38px)',lineHeight:1.2,fontWeight:700})),
      createElement('div',{className:'awb-template-services-grid'},...cards.map((card,index)=>{
        const service=serviceCardLink(card,values)!
        const match=context.serviceLinks?.find(link=>link.label.toLowerCase()===service.label.toLowerCase()) ?? context.serviceLinks?.find(link=>service.label.toLowerCase().includes(link.label.toLowerCase()))
        const href=match?.href||'/services'
        const linkNode=treeNodes(card,node=>node.tag==='a' && /read|more|learn|detail/i.test(anchorText(node,values)))[0]
        const linkSlot=linkNode?.attrs.href as Slot | undefined
        const heading=treeNodes(card,node=>/^h[3-5]$/.test(node.tag))[0]
        const description=treeNodes(card,node=>node.tag==='p')[0]
        const slot=primaryImageSlot(card)
        return createElement('article',{key:index,className:'awb-template-service-card',id:`service-${href.split('/').pop()}`,'data-service-href':route(href,context)},
          slot&&values[slot]?createElement(Media,{src:String(values[slot]),alt:service.label,ratio:'16 / 10',sizeStyle:imageSizing(values,`/${slot}`),'data-awb-element':`/${slot}`,style:{display:'block'}}):null,
          createElement('div',{className:'awb-template-service-body'},clean(heading,'h3',`service-${index}-title`,{margin:0,fontSize:21,lineHeight:1.3,fontWeight:600}),
            clean(description,'p',`service-${index}-description`,{margin:0,fontSize:15,lineHeight:1.7,color:'var(--awb-muted)'}),linkNode?renderTree({...linkNode,attrs:{href:route(href,context),'data-awb-link':linkSlot?.slot?`/${linkSlot.slot}`:undefined}},values,context,section.family,`service-${index}-link`):createElement('a',{href:route(href,context)},'Learn more →')))
      })),callout?clean(callout,'aside','services-callout',{marginTop:32,padding:24,borderRadius:12,background:'var(--awb-surface)'}):null) }))
}

function renderGuidance(section: ImportedSection, values: Record<string, unknown>, context: RenderContext): ReactNode | undefined {
  const cards = treeNodes(section.tree, node => String(node.attrs.className || '').split(/\s+/).includes('single-steps-area-nine'))
  if (!cards.length) return undefined
  const title = treeNodes(section.tree, node => node.tag === 'h2')[0]
  const eyebrow = treeNodes(section.tree, node => String(node.attrs.className || '').includes('pre-title'))[0]
  const clean = (node: Extract<Tree, { tag: string }> | undefined, tag: string, style: CSSProperties, key: string) => node ? renderTree({ ...node, tag, attrs: { style } }, values, context, section.family, key) : null
  return createElement('section', { className: 'awb-guidance', style: { ...templateColorVars(context.tokens), padding: 'clamp(36px,5vw,64px) 0', background: 'var(--awb-bg)', color: 'var(--awb-fg)' } },
    createElement('style', {}, '.awb-guidance-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:20px}.awb-guidance-card{padding:24px;border:1px solid var(--awb-border);border-radius:14px;background:var(--awb-surface);display:flex;flex-direction:column;align-items:flex-start;gap:18px;min-width:0}.awb-guidance-icon svg,.awb-guidance-icon img{width:40px;height:40px;display:block}.awb-guidance-card p:empty{display:none}@media(max-width:991px){.awb-guidance-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:479px){.awb-guidance-grid{grid-template-columns:1fr}}'),
    createElement(SiteContentContainer, { theme: context.templateTheme || section.theme, children: createElement('div', {},
      createElement('header', { style: { marginBottom:32, maxWidth:780 } },
        clean(eyebrow, 'p', { margin:'0 0 10px', fontSize:12, fontWeight:600, letterSpacing:'0.1em', textTransform:'uppercase', color:'var(--awb-primary)' }, 'guidance-eyebrow'),
        clean(title, 'h2', { margin:0, fontSize:'clamp(26px,3vw,38px)', lineHeight:1.18, fontWeight:700 }, 'guidance-title')),
      createElement('div', { className:'awb-guidance-grid' }, ...cards.map((card, index) => {
        const icon = treeNodes(card, node => String(node.attrs.className || '') === 'icon-area')[0]
        const heading = treeNodes(card, node => /^h[3-6]$/.test(node.tag))[0]
        const description = treeNodes(card, node => node.tag === 'p')[0]
        const number = treeNodes(card, node => node.tag === 'span')[0]
        return createElement('article', { key:index, className:'awb-guidance-card' },
          createElement('div', { style:{display:'flex',alignItems:'center',justifyContent:'space-between',width:'100%'} },
            icon ? createElement('div', {className:'awb-guidance-icon','aria-hidden':true}, ...icon.children.map((child,i) => renderTree(child,values,context,section.family,`guidance-${index}-${i}`))) : null,
            number && anchorText(number,values).trim() ? clean(number,'span',{fontSize:12,color:'var(--awb-muted)'},`guidance-${index}-number`) : null),
          clean(heading,'h3',{margin:0,fontSize:18,lineHeight:1.4,fontWeight:600},`guidance-${index}-title`),
          description && anchorText(description,values).trim() ? clean(description,'p',{margin:0,fontSize:14,lineHeight:1.65,color:'var(--awb-muted)'},`guidance-${index}-description`) : null)
      }))) }))
}

function renderTree(tree: Tree, values: Record<string, unknown>, context: RenderContext, family: string, key = 'root'): ReactNode {
  if (typeof tree === 'string') return tree
  if ('slot' in tree) {
    const value = String(values[tree.slot] ?? '')
    return value ? createElement('span', { key, 'data-awb-element': `/${tree.slot}`, style: elementColor(values, `/${tree.slot}`) }, `${value} `) : null
  }
  if ('kind' in tree) {
    if (tree.kind === 'logo') return createElement('span', { key, className: 'wt-layout-logo' }, values.logoImageUrl ? createElement('img', { src: String(values.logoImageUrl), alt: String(values.logoText || values.businessName || ''), 'data-awb-element': '/logoImageUrl' }) : createElement('span', { 'data-awb-element': '/logoText', style: elementColor(values, '/logoText') }, String(values.logoText || values.businessName || '')))
    if (tree.kind === 'menu') {
      const items = (values.items || []) as Array<{ label: string; href: string; children?: Array<{ label: string; href: string }> }>
      return createElement('ul', { ...tree.attrs, key }, items.map((item, index) => createElement('li', { key:index }, item.children?.length
        ? createElement('details', { className:'wt-layout-dropdown' }, createElement('summary', { 'data-awb-element':`/items/${index}/label` }, item.label, ' ▾'), createElement('ul', { className:'wt-layout-submenu' }, [item,...item.children].map((child,j) => createElement('li',{key:j},createElement('a',{href:route(child.href,context)}, j===0 ? `${child.label} overview` : child.label)))))
        : createElement('a', { className:'nav-link',href:route(item.href,context),'data-awb-element':`/items/${index}/label` },item.label))))
    }
    if (tree.kind === 'form') return renderContactForm(contactPropsSchema.parse({ heading: '', formFields: [ { name:'name',label:'Name',type:'text',required:true }, { name:'email',label:'Email',type:'email',required:true }, { name:'phone',label:'Phone',type:'tel' }, { name:'message',label:'Message',type:'textarea',required:true } ], submitLabel: values.submitLabel || 'Send enquiry' }), context)
    return null
  }
  const classes=String(tree.attrs.className||'')
  if(family==='HEADER' && /(?:^|\s)(?:header-top|rs-header-top)(?:\s|$)/.test(classes)) {
    const email=String(values.email||'').trim()
    const phone=String(values.phone||'').trim()
    if(!email&&!phone)return null
    return createElement('div',{key,className:'awb-header-contact-bar',style:{background:'var(--awb-surface)',color:'var(--awb-fg)',padding:'8px 0',fontSize:13}},
      createElement(SiteContentContainer,{theme:context.templateTheme||'webtummy-business',children:createElement('div',{style:{display:'flex',flexWrap:'wrap',justifyContent:'flex-end',alignItems:'center',gap:'8px 24px'}},
        email?createElement('a',{href:`mailto:${email}`,style:{color:'inherit',textDecoration:'none',overflowWrap:'anywhere'}},email):null,
        phone?createElement('a',{href:`tel:${phone.replace(/[^+\d]/g,'')}`,style:{color:'inherit',textDecoration:'none'}},phone):null)}))
  }
  if(family==='HEADER' && /(?:^|\s)call-area(?:\s|$)/.test(classes)) return null
  if (/\brts-single-wized\b/.test(classes) && /\bdownload\b/.test(classes) || /\bsingle-download-area\b/.test(classes)) {
    const files=treeNodes(tree,node=>node.tag==='a').map(node=>{
      const href=node.attrs.href
      return href&&typeof href==='object'&&'slot' in href?String(values[String(href.slot)]||''):String(href||'')
    })
    if(!files.some(href=>/\.(pdf|docx?)(?:[?#]|$)/i.test(href)&&safeLink(href)!=='#')) return null
  }
  const attrs: Record<string, unknown> = { ...tree.attrs, key }
  for(const property of ['fill','stroke','stopColor','floodColor']) if(typeof attrs[property]==='string') attrs[property]=templateBrandColor(attrs[property] as string)
  if (tree.tag === 'i' && /arrow-right/.test(String(attrs.className || ''))) return createElement('span',{key,'aria-hidden':true,style:{marginLeft:8}},'→')
  const serviceLink = family === 'SERVICES' ? serviceCardLink(tree, values) : undefined
  if (serviceLink) {
    attrs.id = `service-${serviceLink.href.split('/').pop()}`
    attrs.style = { ...(attrs.style as CSSProperties), scrollMarginTop:100 }
    const target = context.serviceLinks?.find(link=>link.label.toLowerCase()===serviceLink.label.toLowerCase())?.href || '/services'
    attrs['data-service-href'] = route(target,context)
    values = { ...values, __serviceHref:target }
  }
  if (typeof attrs.className === 'string' && attrs.className.split(/\s+/).includes('swiper-slide')) {
    // Imported slides render without the demo's slider JavaScript.
    attrs.className += ' swiper-slide-active'
  }
  if (attrs.style && typeof attrs.style==='object') {
    const style={...attrs.style as Record<string,unknown>}
    for(const [property,value] of Object.entries(style)) if(typeof value==='string'&&/color|fill|stroke|border|shadow/i.test(property)) style[property]=templateBrandColor(value)
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
      attrs[name] = name === 'href' ? route(!resolved || resolved === '#' || values.__serviceHref && resolved === '/services' ? String(values.__serviceHref || placeholderLink(tree, values, family)) : resolved, context) : resolved
      if (name === 'src') { attrs['data-awb-element'] = `/${slot}`; attrs.style = { ...(attrs.style as CSSProperties), ...elementColor(values, `/${slot}`) } }
      if (name === 'href') attrs['data-awb-link'] = `/${slot}`
    }
  }
  if (tree.tag === 'img') {
    if(typeof attrs.src==='string'&&iconTrees[attrs.src]) {
      const icon=iconTrees[attrs.src] as Extract<Tree,{tag:string}>
      return renderTree({...icon,attrs:{...icon.attrs,'aria-hidden':true,'data-template-icon':true,style:{display:'block',maxWidth:'100%',...attrs.style as CSSProperties}},children:icon.children},values,context,family,`${key}-icon`)
    }
    if (!attrs.src) return context.editing ? createElement('div', { key, 'data-awb-element': attrs['data-awb-element'], style:{ minHeight:160,background:'var(--awb-surface)',border:'1px dashed var(--awb-border)',padding:24 } }, 'Choose an image') : null
    attrs.loading = 'lazy'; attrs.alt = values.imageAlt || attrs.alt || ''
  }
  if (typeof attrs.className === 'string' && attrs.className.split(/\s+/).includes('swiper') && family !== 'HERO') attrs['data-layout-carousel'] = true
  // Keep template selectors on their original elements. An extra span inside
  // a heading can accidentally receive a template's badge or eyebrow styles.
  const content = tree.children.filter(child => typeof child !== 'string' || child.trim())
  if (tree.tag === 'button' && String(attrs.className || '').includes('accordion-button')) return createElement('span', { key, className:'wt-layout-faq-label' }, ...tree.children.map((child,index)=>renderTree(child,values,context,family,`${key}-${index}`)))
  if (family === 'HEADER' && tree.tag === 'a' && content.some(child=>typeof child==='object' && 'kind' in child && child.kind==='logo')) attrs.href=route('/',context)
  if (tree.tag === 'a' && attrs.href === '#' && !anchorText(tree, values).trim()) return null
  if (tree.tag === 'a' && !anchorText(tree, values).trim() && content.every(child => typeof child === 'object' && 'slot' in child)) return null
  if (content.length === 1 && typeof content[0] === 'object' && 'slot' in content[0]) {
    const slot = content[0].slot
    attrs['data-awb-element'] = `/${slot}`
    attrs.style = { ...(attrs.style as CSSProperties), ...elementColor(values, `/${slot}`) }
    return createElement(tree.tag, attrs, String(values[slot] ?? ''))
  }
  if(tree.tag==='h1') {
    const text=anchorText(tree,values).trim()
    if(!text)return null
    const slotKey=(function firstSlot(node:Tree):string|undefined {
      if(typeof node!=='object')return undefined
      if('slot' in node)return node.slot
      return 'children' in node?node.children.map(firstSlot).find(Boolean):undefined
    })(tree)
    return createElement('h1',{...attrs,...(slotKey?{'data-awb-element':`/${slotKey}`,style:{...(attrs.style as CSSProperties),...elementColor(values,`/${slotKey}`)}}:{})},text)
  }
  // A template may contain a video or iframe placeholder; never run demo embeds.
  if (['input','img','br','hr','meta','source','path','circle','use'].includes(tree.tag)) return createElement(tree.tag, attrs)
  return createElement(tree.tag, attrs, ...tree.children.map((child, index) => renderTree(child, values, context, family, `${key}-${index}`)))
}

const menuSchema = z.array(z.object({ label:z.string(),href:z.string(),children:z.array(z.object({label:z.string(),href:z.string()})).default([]) })).default([])
export const importedLayoutDefinitions: ComponentDefinition[] = sections.map(section => {
  const shape: Record<string, z.ZodType> = Object.fromEntries(section.fields.map(field => [field.path.slice(1), z.string().max(field.type === 'textarea' ? 12000 : 3000).default('')]))
  shape.imageAlt = z.string().default('')
  shape.submitLabel = z.string().default('Send enquiry')
  if (['HEADER','FOOTER'].includes(section.family)) { shape.logoText=z.string().default('');shape.businessName=z.string().default('');shape.logoImageUrl=z.string().default('');shape.items=menuSchema;shape.sticky=z.boolean().default(false);shape.email=z.string().default('');shape.phone=z.string().default('') }
  if (section.family === 'FOOTER') Object.assign(shape, footerPropsSchema.shape, { businessName:z.string().default('') })
  return {
    componentId:section.componentId,version:'1.0.0',family:section.family as ComponentFamily,name:section.name,
    description:`Imported ${section.theme} layout section. Preserve its structure and replace demonstration copy with supplied business content.`,
    aiGuidance:'Use only when its template is selected. Fill all text slots with relevant supplied facts; omit unsupported claims and keep image slots empty for generation. Preserve the original section order.',
    propsSchema:z.object(shape),editorFields:[...section.fields.filter(field=>section.family!=='HERO'||field.headingLevel!==1||field===section.fields.find(candidate=>candidate.headingLevel===1)),{path:'/imageAlt',label:'Image description',type:'text'},...(section.family==='HEADER'?[{path:'/logoText',label:'Business name',type:'text' as const},{path:'/logoImageUrl',label:'Logo',type:'image' as const},{path:'/items',label:'Navigation',type:'list' as const},{path:'/sticky',label:'Sticky header',type:'boolean' as const}]:[]),...(section.family==='FOOTER'?footerEditorial.editorFields:[])],tokenDeps:[],fixture:normalizeTemplateHeading(section.componentId,section.fixture),
    render:({props,context}) => {
      const values = normalizeTemplateHeading(section.componentId,{ ...props as Record<string, unknown> })
      const photoHero=renderPhotoHero(section,values,context)
      if(photoHero) return photoHero
      const services=renderServiceGrid(section,values,context)
      if(services) return services
      const guidance = renderGuidance(section, values, context)
      if (guidance) return guidance
      if(section.family==='CONTACT'&&typeof section.tree==='object'&&'tag' in section.tree&&String(section.tree.attrs.className||'').split(/\s+/).includes('contact-one')) {
        return TemplateEnquiry({values,context:{...context,templateTheme:context.templateTheme||section.theme}})
      }
      if (section.family === 'FOOTER') {
        // Render actual site navigation and contact details rather than the
        // demo's newsletter form, gallery, placeholder socials and empty columns.
        const renderFooter = footerEditorial.render as (input: { props:z.infer<typeof footerPropsSchema>;context:RenderContext }) => ReactNode
        return createElement('div', { 'data-layout-family':'FOOTER' }, renderFooter({
          props:footerPropsSchema.parse({ ...values, businessName:values.businessName || values.logoText || '' }), context,
        }))
      }
      if (section.family === 'HEADER') {
        for (const field of section.fields) {
          const name = field.path.slice(1)
          if (!values[name] && /book.*meeting|get.*quote|let.s talk/i.test(section.fixture[name] || '')) values[name] = 'Get in touch'
        }
      }
      return createElement('div',{className:`wt-layout-${section.theme} ${section.bodyClass || ''}`, 'data-layout-family':section.family,style:{position:'relative',...templateColorVars(context.tokens)}},createElement('link',{rel:'stylesheet',href:`/template-library/${section.theme}/editable.css?v=20261008-header-clean-1`,precedence:`layout-${section.theme}`}),renderTree(section.tree,values,{...context,templateTheme:context.templateTheme||section.theme},section.family),section.family==='HEADER'?createElement('details',{className:'wt-layout-mobile-menu'},createElement('summary',{},'Menu'),renderTree({kind:'menu'},values,context,section.family)):null)
    },
  }
})

export function templateCopyCatalogue(ids: string[]) {
  return ids.flatMap(id => {
    const section = importedSection(id)
    if(!section)return []
    return { componentId:id,family:section.family,fields:section.fields.filter(field=>field.type!=='link' && field.type!=='image'),exampleProps:Object.fromEntries(section.fields.filter(field=>!['link','image'].includes(field.type)).map(field=>[field.path.slice(1),section.fixture[field.path.slice(1)]])) }
  })
}
