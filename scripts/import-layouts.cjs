// Compile reviewed HTML themes into immutable React trees and editable fields.
// Run after unpacking theme1.zip / finbiz-html.zip into public/template-library.
const fs = require('node:fs'), path = require('node:path')
const { JSDOM } = require('jsdom')
const postcss = require('postcss')
const root = path.resolve(__dirname, '..')
const library = path.join(root, 'apps/web/public/template-library')
const rectangle=path.join(library,'finbiz/assets/images/banner/shape/rectangle.png')
if(!fs.existsSync(rectangle))fs.copyFileSync(path.join(library,'finbiz/assets/images/banner/shape/Rectangle.png'),rectangle)
const configs = [
  { theme: 'insurigo', files: ['index.html','index-2.html','index-3.html','index-4.html'], names: ['Insurance Classic','Insurance Modern','Insurance Editorial','Insurance Bold'], secondary: { about:'about-1.html', services:'service-1.html', service:'life-insurance.html', contact:'contact.html' } },
  { theme: 'finbiz', files: ['index.html','index-two.html','index-three.html','index-four.html','index-five.html','index-six.html','index-seven.html','index-eight.html','index-nine.html','index-ten.html','index-eleven.html','index-twelve.html','index-thirteen.html','index-fourteen.html'], names: ['Business Classic','Consulting Modern','Business Strategy','Insurance Professional','Marketing Studio','Financial Advisory','Business Partnership','IT & Staffing','Digital Agency','Startup Studio','Branding Agency','Growth Consulting','Business Management','Business Growth'], secondary: { about:'about-us.html', services:'our-service.html', service:'service-details.html', contact:'contactus.html' } },
]
const output = { templates: [], sections: [] }
const backgrounds = new Map()
const skip = /off-canvas|side-bar|search-input-area|loader|pre-load|progress-wrap|scrollUp|anywhere-home|search-area|back-to-top/
const familyFor = (el, index) => {
  const s = `${el.className} ${el.id}`.toLowerCase()
  if (el.tagName === 'HEADER' || /^header[- ]/.test(s)) return 'HEADER'
  if (el.tagName === 'FOOTER' || /footer|copyright|copy-right/.test(s)) return 'FOOTER'
  if (/banner|breadcrumb/.test(s) || index === 0) return 'HERO'
  if (/testimonial|feedback|review|trusted-client/.test(s)) return 'REVIEWS'
  if (/counter|award|brand|partner/.test(s)) return 'CREDENTIALS'
  if (/team/.test(s)) return 'TEAM'
  if (/gallery|project|portfolio/.test(s)) return 'PORTFOLIO'
  if (/blog/.test(s)) return 'PORTFOLIO'
  if (/pricing|price/.test(s)) return 'PRICING'
  if (/faq|accordion/.test(s)) return 'FAQ'
  if (/contact|compare|appointment|quote|map-area/.test(s)) return 'CONTACT'
  if (/cta|newsletter/.test(s)) return 'CTA'
  if (/service/.test(s)) return 'SERVICES'
  return 'ABOUT'
}
function styleObject(el) {
  const result = {}
  for (const name of Array.from(el.style || [])) {
    const key = name.startsWith('--') ? name : name.replace(/-([a-z])/g, (_, c) => c.toUpperCase())
    result[key] = el.style.getPropertyValue(name)
  }
  return result
}
function compile(el, theme, file, componentId, family) {
  const fields = [], fixture = {}, counts = { text:0, image:0, link:0 }
  const field = (type, value, label, headingLevel) => {
    let key = `${type}${counts[type]++}`
    if (headingLevel === 1 && !('heading' in fixture)) key = 'heading'
    if (type === 'image' && !('imageUrl' in fixture)) key = 'imageUrl'
    fixture[key] = value
    fields.push({path:`/${key}`,label,type:type === 'text' ? value.length > 140 ? 'textarea' : 'text' : type, ...(headingLevel ? {headingLevel} : {})})
    return key
  }
  const asset = value => {
    if (!value) return ''
    if (/^(data:|https?:|\/\/)/.test(value)) return value.startsWith('https://demo.rstheme') ? '/template-library/insurigo/assets/images/logo-1.png' : value
    return `/template-library/${theme}/${path.posix.normalize(value.trim().replace(/^\.\//,''))}`
  }
  const visit = node => {
    if (node.nodeType === 3) {
      const value = node.textContent.replace(/\s+/g, ' ')
      if (!value.trim()) return value
      const headingNode = node.parentElement?.closest('h1,h2,h3')
      const headingLevel = headingNode ? Number(headingNode.tagName.slice(1)) : undefined
      return { slot: field('text',value,`${headingLevel ? `Heading H${headingLevel}` : 'Text'}: ${value.trim().slice(0,65)}`,headingLevel) }
    }
    if (node.nodeType !== 1 || ['SCRIPT','STYLE','IFRAME','NOSCRIPT','LINK'].includes(node.tagName)) return null
    const tag = node.tagName.toLowerCase()
    const cls = typeof node.className === 'string' ? node.className : ''
    // Proof widgets nested inside ordinary content are demo evidence too.
    // Keep dedicated review sections available for supplied reviews only.
    if (!['REVIEWS','TEAM','CREDENTIALS'].includes(family) && /testimonial|review|rating|founder|signature|award|author-area|brand-area/.test(cls)) return null
    if (/pre-load|loader|swiper-pagination|swiper-button|slick-arrow|search|menu-btn|menu-button|hamburger/.test(cls) || ['search','menu-btn'].includes(node.id)) return null
    if (/fa-star|ri-star|star-fill|star-line/.test(cls)) return null
    if (tag === 'form') return { kind:'form' }
    if (tag === 'ul' && (family === 'HEADER' && (node.closest('nav') || /nav-menu|menu-main|mainmenu/.test(cls)) || family === 'FOOTER' && Array.from(node.querySelectorAll('a')).some(a=>/\.html/.test(a.getAttribute('href') || '')))) return { kind:'menu',attrs:{className:cls} }
    if (['HEADER','FOOTER'].includes(family) && tag === 'img' && /logo/i.test(node.getAttribute('src') || '')) return { kind:'logo' }
    if (tag === 'img') {
      const source = node.getAttribute('src') || ''
      if (/badge|award|signature|rating|star|\/user\/|\/team\//i.test(source)) return null
      if (/logo/i.test(source) && !/service\/icon\//i.test(source)) return null
      if (family === 'REVIEWS' && !/shape|pattern|icon/i.test(source)) return null
    }
    // Use native disclosures instead of Bootstrap's script-dependent accordion.
    if (/accordion-item/.test(cls)) {
      const heading = node.querySelector('.accordion-button, .accordion-header'), body = node.querySelector('.accordion-body')
      if (heading && body) return {tag:'details',attrs:{className:cls},children:[{tag:'summary',attrs:{className:'accordion-button'},children:Array.from(heading.childNodes).map(visit).filter(Boolean)},{tag:'div',attrs:{className:'accordion-body'},children:Array.from(body.childNodes).map(visit).filter(Boolean)}]}
    }
    const attrs = {}
    for (const attr of node.attributes) {
      let name = attr.name, value = attr.value.trim()
      if (/^on/i.test(name) || /^(action|formaction|srcdoc|data-bs-|data-toggle|data-target)/.test(name)) continue
      if (name === 'class') { attrs.className = value.replace(/\b(wow|fadeIn\w*|slideIn\w*|animated)\b/g,''); continue }
      if (name === 'style') { attrs.style = styleObject(node); continue }
      if (name === 'src' && tag === 'img') {
        const decorative = /shape|icon|logo|star|badge|pattern/.test(value)
        attrs.src = decorative ? asset(value) : { slot:field('image',asset(value),'Image') }
        continue
      }
      if (name === 'href' && tag === 'a') {
        if (/^(javascript|vbscript|data):/i.test(value)) value = '#'
        if (/\.html(?:$|#)/i.test(value)) {
          const basename = path.posix.basename(value).toLowerCase()
          value = /^index|^onepage/.test(basename) ? '/' : /about/.test(basename) ? '/about' : /contact|appoin/.test(basename) ? '/contact' : /service|insurance/.test(basename) ? '/services' : '#'
        }
        attrs.href = {slot:field('link',value || '#','Link')};continue
      }
      if (name === 'srcset') continue
      if (name === 'id') { attrs.id = `${componentId}-${value}`; continue }
      const renames = { tabindex:'tabIndex', colspan:'colSpan', rowspan:'rowSpan', for:'htmlFor', viewbox:'viewBox', 'stroke-width':'strokeWidth', 'fill-rule':'fillRule', 'clip-rule':'clipRule', 'stroke-linecap':'strokeLinecap', 'stroke-linejoin':'strokeLinejoin' }
      name = renames[name] || name
      if (['src','href'].includes(name) && /^(javascript|vbscript):/i.test(value)) continue
      attrs[name] = value
    }
    if (attrs.style) for (const k of Object.keys(attrs.style)) {
      attrs.style[k] = String(attrs.style[k]).replace(/url\(['"]?([^)'"\s]+)['"]?\)/g,(_,url)=>`url("${asset(url)}")`)
    }
    let background = node.style.backgroundImage || node.getAttribute('data-background') || node.getAttribute('data-bg') || ''
    if (!background) for (const rule of backgrounds.get(theme) || []) { try { if(node.matches(rule.selector)) background=rule.value } catch {} }
    const backgroundUrl=/url\(['"]?([^)'"\s]+)['"]?\)/.exec(background)?.[1] || (/\.(png|jpe?g|webp)$/i.test(background)?background:'')
    if(backgroundUrl && !/shape|pattern|icon|logo/i.test(backgroundUrl)){
      attrs.style={...(attrs.style || {}),backgroundImage:{imageSlot:field('image',asset(backgroundUrl),'Background image')}}
    }
    let sourceChildren = Array.from(node.childNodes)
    if (/swiper-wrapper|rs-banner-slider/.test(cls) && family === 'HERO') sourceChildren=Array.from(node.children).slice(0,1)
    const children = sourceChildren.map(visit).filter(x=>x !== null)
    return {tag,attrs,children}
  }
  const tree = visit(el)
  return { componentId,theme,family,name:`${theme === 'finbiz' ? 'Finbiz' : 'Insurigo'} · ${family.toLowerCase()} · ${file}`,fields,fixture,tree }
}
function compilePage(config,file,id) {
  const doc = new JSDOM(fs.readFileSync(path.join(library,config.theme,file),'utf8')).window.document
  let body = doc.body
  if (body.children.length < 8 && body.querySelector('main')) body=body.querySelector('main')
  const blocks = Array.from(body.children).filter(el=>!['SCRIPT','STYLE','LINK','NOSCRIPT'].includes(el.tagName) && !skip.test(`${el.className} ${el.id}`))
  const footerBlocks = blocks.filter(el=>familyFor(el,99)==='FOOTER')
  if(footerBlocks.length>1) for(const extra of footerBlocks.slice(1)){footerBlocks[0].appendChild(extra);blocks.splice(blocks.indexOf(extra),1)}
  const ids=[];let bodyIndex=0
  for (const [index,el] of blocks.entries()) {
    const family=familyFor(el,bodyIndex)
    if(family!=='HEADER' && family!=='FOOTER')bodyIndex++
    const componentId=`Tpl_${id.replace(/-/g,'_')}_${index}`
    const section={...compile(el,config.theme,file,componentId,family),bodyClass:doc.body.className}
    if (!section.fields.length && !el.querySelector('form,img')) continue
    output.sections.push(section);ids.push(componentId)
  }
  return ids
}
for (const config of configs) {
  const sourceDoc=new JSDOM(fs.readFileSync(path.join(library,config.theme,config.files[0]),'utf8')).window.document
  const rules=[]
  for(const link of sourceDoc.querySelectorAll('link[rel="stylesheet"]')){
    const href=link.getAttribute('href');if(!href || /^https?:/.test(href))continue
    const css=postcss.parse(fs.readFileSync(path.join(library,config.theme,href),'utf8'))
    css.walkRules(rule=>{
      let parent=rule.parent;while(parent){if(parent.type==='atrule' && parent.name==='media')return;parent=parent.parent}
      for(const decl of rule.nodes || [])if(decl.type==='decl' && /^(background|background-image)$/.test(decl.prop) && /url\(/.test(decl.value)){
        const value=decl.value.replace(/url\((['"]?)(.*?)\1\)/g,(all,q,url)=>`url("${path.posix.normalize(path.posix.join(path.posix.dirname(href),url))}")`)
        for(const selector of rule.selectors)rules.push({selector,value})
      }
    })
  }
  backgrounds.set(config.theme,rules)
  const secondary = Object.fromEntries(Object.entries(config.secondary).map(([key,file])=>[key,compilePage(config,file,`${config.theme}_${key}`)]))
  config.files.forEach((file,index)=>{
    const id=`${config.theme}-${index+1}`
    const sections=compilePage(config,file,id)
    const header=sections.find(s=>output.sections.find(x=>x.componentId===s).family==='HEADER')
    const footer=sections.find(s=>output.sections.find(x=>x.componentId===s).family==='FOOTER')
    if(!header || !footer)throw Error(`Missing chrome ${id}`)
    output.templates.push({id,theme:config.theme,name:config.names[index],category:config.theme==='insurigo' || index===3 ? 'Insurance' : index===4 ? 'Marketing' : index===5 ? 'Finance' : index===7 ? 'Technology' : index===8 || index===10 ? 'Agency' : 'Business',preview:`/template-library/${config.theme}/${file}`,thumbnail:`/template-library/thumbnails/${id}.webp`,home:sections,secondary,header,footer})
  })
  const scope=`.wt-layout-${config.theme}`
  const bodyVariants=new Set(output.sections.filter(section=>section.theme===config.theme).flatMap(section=>(section.bodyClass || '').split(/\s+/)).filter(Boolean))
  let styles=''
  // Resolve each stylesheet URL relative to its own directory, then scope rules.
  const doc=new JSDOM(fs.readFileSync(path.join(library,config.theme,config.files[0]),'utf8')).window.document
  for(const link of doc.querySelectorAll('link[rel="stylesheet"]')){
    const href=link.getAttribute('href');if(!href || /^https?:/.test(href))continue
    const absolute=path.join(library,config.theme,href)
    const css=postcss.parse(fs.readFileSync(absolute,'utf8'))
    css.walkComments(comment=>comment.remove())
    css.walkDecls(decl=>{
      let missing = false
      decl.value=decl.value.replace(/([\d.]+)rem\b/g,(_,value)=>`${Number(value)*(config.theme==='finbiz'?10:16)}px`).replace(/url\((['"]?)(.*?)\1\)/g,(match,quote,url)=>{
        if (/^(data:|https?:|\/\/|#)/.test(url)) return match
        const relative=path.posix.normalize(path.posix.join(path.posix.dirname(href),url))
        if (!fs.existsSync(path.join(library,config.theme,relative.split(/[?#]/)[0]))) missing = true
        return `url("/template-library/${config.theme}/${relative}")`
      })
      // Some unused theme utilities refer to assets absent from the archive.
      if (missing) decl.remove()
    })
    css.walkRules(rule=>{
      if(rule.parent.type==='atrule' && /keyframes/.test(rule.parent.name))return
      rule.selectors=rule.selectors.map(selector=>{
        let value=selector.replace(/:root|(?<![\w.#-])(?:html|body)(?![\w-])/g,scope)
        if (value.includes(scope)) return value
        const firstClass=/^\.([\w-]+)/.exec(value.trim())?.[1]
        return firstClass && bodyVariants.has(firstClass) ? `${scope}${value.trim()}` : `${scope} ${value}`
      })
    })
    styles+=css.toString()+'\n'
  }
  styles+=`\n${scope}{font-family:Epilogue,Arial,sans-serif;font-size:16px;line-height:1.6;width:100%;overflow-x:clip} ${scope} *{box-sizing:border-box} ${scope} .wow{visibility:visible!important} ${scope} .swiper-wrapper{height:auto;transform:none!important} ${scope} .swiper-slide{height:auto;flex-shrink:0;width:100%} ${scope} .swiper:not([data-layout-carousel]){overflow:hidden} ${scope} .owl-carousel{display:flex;overflow:auto;gap:24px} ${scope} .owl-carousel>*{flex:0 0 min(85%,380px)} ${scope} .rs-banner-slider>div:not(:first-child){display:none} ${scope} [class*="rs-banner"]{margin-top:0!important} ${scope} header{position:relative!important;top:auto!important} ${scope} [data-layout-carousel] .swiper-wrapper{display:flex;overflow:auto;scroll-snap-type:x mandatory} ${scope} [data-layout-carousel] .swiper-slide{width:min(85%,380px);scroll-snap-align:start} ${scope} .wt-layout-logo{font-size:24px;font-weight:800;line-height:1.2;color:inherit} ${scope} .wt-layout-logo img{max-width:160px;height:auto} ${scope} .wt-layout-mobile-menu{display:none} ${scope} details>summary{cursor:pointer;list-style:none} ${scope} details[open]>summary{margin-bottom:16px} ${scope} details .accordion-body{display:block} ${scope} .collapse{display:block} ${scope} .counter,${scope} .odometer{font-size:inherit} @media(max-width:991px){${scope} .wt-layout-mobile-menu{display:block;padding:12px 20px;background:var(--awb-surface,#fff)} ${scope} .wt-layout-mobile-menu ul{list-style:none;padding:0} ${scope} .wt-layout-mobile-menu a{display:block;padding:8px;color:inherit} ${scope} nav.nav-main,${scope} .rs-header-menu{display:none}}`
  // Animation names are global even when their selectors are scoped.
  const scopedCss=postcss.parse(styles)
  const animations=new Map()
  scopedCss.walkAtRules(rule=>{
    if (/keyframes$/.test(rule.name)) {
      const original=rule.params.trim()
      const name=`wt-${config.theme}-${original}`
      animations.set(original,name)
      rule.params=name
    }
  })
  scopedCss.walkDecls(decl=>{
    if (/(?:^|-)animation(?:-name)?$/.test(decl.prop)) decl.value=decl.value.replace(/[A-Za-z_][\w-]*/g,word=>animations.get(word) || word)
  })
  fs.writeFileSync(path.join(library,config.theme,'editable.css'),scopedCss.toString())
}
fs.mkdirSync(path.join(root,'packages/component-registry/src/imported'),{recursive:true})
fs.writeFileSync(path.join(root,'packages/component-registry/src/imported/layouts.json'),JSON.stringify(output))
fs.writeFileSync(path.join(root,'packages/shared/src/layout-catalogue.json'),JSON.stringify(output.templates.map(({id,theme,name,category,preview,thumbnail})=>({id,theme,name,category,preview,thumbnail})),null,2))
console.log(`Compiled ${output.templates.length} layouts and ${output.sections.length} editable sections`)
