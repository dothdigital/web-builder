// Compile reviewed HTML themes into immutable React trees and editable fields.
// Run after unpacking theme1.zip / webtummy-business-html.zip into public/template-library.
const fs = require('node:fs'), path = require('node:path')
const { JSDOM } = require('jsdom')
const postcss = require('postcss')
const root = path.resolve(__dirname, '..')
const brandColorRoles = require('../packages/component-registry/src/imported/brand-colors.json')
const {compileDecorativeIcons}=require('./compile-template-icons.cjs')
const library = path.join(root, 'apps/web/public/template-library')
const rectangle=path.join(library,'webtummy-business/assets/images/banner/shape/rectangle.png')
if(!fs.existsSync(rectangle))fs.copyFileSync(path.join(library,'webtummy-business/assets/images/banner/shape/Rectangle.png'),rectangle)
const configs = [
  { theme: 'webtummy-insurance', files: ['index.html','index-2.html','index-3.html','index-4.html'], names: ['Insurance Classic','Insurance Modern','Insurance Editorial','Insurance Bold'], secondary: { about:'about-1.html', services:'service-1.html', service:'life-insurance.html', contact:'contact.html' } },
  { theme: 'webtummy-business', files: ['index.html','index-two.html','index-three.html','index-four.html','index-five.html','index-six.html','index-seven.html','index-eight.html','index-nine.html','index-ten.html','index-eleven.html','index-twelve.html','index-thirteen.html','index-fourteen.html'], names: ['Business Classic','Consulting Modern','Business Strategy','Insurance Professional','Marketing Studio','Financial Advisory','Business Partnership','IT & Staffing','Digital Agency','Startup Studio','Branding Agency','Growth Consulting','Business Management','Business Growth'], secondary: { about:'about-us.html', services:'our-service.html', service:'service-details.html', contact:'contactus.html' } },
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
    if (/^(data:|https?:|\/\/)/.test(value)) return value.startsWith('https://demo.webtummy') ? '/template-library/webtummy-insurance/assets/images/logo-1.png' : value
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
  return { componentId,theme,family,name:`${theme === 'webtummy-business' ? 'Webtummy' : 'Webtummy'} · ${family.toLowerCase()} · ${file}`,fields,fixture,tree }
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
    output.templates.push({id,theme:config.theme,name:config.names[index],category:config.theme==='webtummy-insurance' || index===3 ? 'Insurance' : index===4 ? 'Marketing' : index===5 ? 'Finance' : index===7 ? 'Technology' : index===8 || index===10 ? 'Agency' : 'Business',preview:`/template-library/previews/${id}.html`,thumbnail:`/template-library/thumbnails/${id}.webp`,home:sections,secondary,header,footer})
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
      decl.value=decl.value.replace(/([\d.]+)rem\b/g,(_,value)=>`${Number(value)*(config.theme==='webtummy-business'?10:16)}px`).replace(/url\((['"]?)(.*?)\1\)/g,(match,quote,url)=>{
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
  styles+=`\n${scope}{font-family:Epilogue,Arial,sans-serif;font-size:16px;line-height:1.6;width:100%;overflow-x:clip} ${scope} *{box-sizing:border-box} ${scope} .wow{visibility:visible!important} ${scope} .swiper-wrapper{height:auto;transform:none!important} ${scope} .swiper-slide{height:auto;flex-shrink:0;width:100%} ${scope} .swiper-slide-active *{animation:none!important} ${scope} .rts-cse-study-3-wrapper .thumbnail .content{position:relative;left:auto;bottom:auto;transform:none!important;width:100%;padding:24px} ${scope} .swiper:not([data-layout-carousel]){overflow:hidden} ${scope} .owl-carousel{display:flex;overflow:auto;gap:24px} ${scope} .owl-carousel>*{flex:0 0 min(85%,380px)} ${scope} .rs-banner-slider>div:not(:first-child){display:none} ${scope} [class*="rs-banner"]{margin-top:0!important} ${scope} header{position:relative!important;top:auto!important} ${scope}[data-layout-family="HEADER"]{overflow:visible;background:var(--awb-bg,#fff);color:var(--awb-fg,#102a43);z-index:50} ${scope}[data-layout-family="HEADER"]>:not(link):not(style):not(details){position:relative!important;top:auto!important} ${scope}[data-layout-family="HEADER"] nav a{color:inherit!important} ${scope} [data-layout-carousel] .swiper-wrapper{display:flex;overflow:auto;scroll-snap-type:x mandatory} ${scope} [data-layout-carousel] .swiper-slide{width:min(85%,380px);scroll-snap-align:start} ${scope} .wt-layout-logo{font-size:24px;font-weight:800;line-height:1.2;color:inherit} ${scope} .wt-layout-logo img{max-width:160px;height:auto} ${scope} .wt-layout-mobile-menu{display:none} ${scope} details>summary{cursor:pointer;list-style:none} ${scope} details[open]>summary{margin-bottom:16px} ${scope} details .accordion-body{display:block} ${scope} .collapse{display:block} ${scope} .counter,${scope} .odometer{font-size:inherit} @media(max-width:1199px){${scope} .wt-layout-mobile-menu{display:block;padding:12px 20px;background:var(--awb-surface,#fff)} ${scope} .wt-layout-mobile-menu ul{list-style:none;padding:0} ${scope} .wt-layout-mobile-menu a{display:block;padding:8px;color:inherit} ${scope} nav.nav-main,${scope} .rs-header-menu{display:none}}`
  if (config.theme === 'webtummy-business') styles += `\n.wt-layout-webtummy-business .rts-service-details-area .service-detials-step-1>.thumbnail>img{display:block;width:100%;height:clamp(220px,26vw,360px);object-fit:cover;border-radius:14px}
.wt-layout-webtummy-business .rts-service-details-area .thumbnail.sm-thumb-service img{display:block;width:100%;height:240px;object-fit:cover;border-radius:12px}
@media(max-width:767px){.wt-layout-webtummy-business .rts-service-details-area{padding-top:40px;padding-bottom:40px}.wt-layout-webtummy-business .rts-service-details-area .service-detials-step-1>.thumbnail>img{height:220px}.wt-layout-webtummy-business .rts-service-details-area .thumbnail.sm-thumb-service img{height:200px}}
`
  if (config.theme === 'webtummy-business') styles += `\n.wt-layout-webtummy-business .why-choose-us-section-10{padding-top:64px;padding-bottom:64px}
.wt-layout-webtummy-business .experience-ten-area-left .title-area-left-ten .title{margin-bottom:20px}
.wt-layout-webtummy-business .experience-ten-area-left .title-area-left-ten p.disc{max-width:100%;margin-bottom:24px}
@media(max-width:767px){.wt-layout-webtummy-business .why-choose-us-section-10{padding-top:40px;padding-bottom:40px}}
`
  if (config.theme === 'webtummy-business') styles += `\n.wt-layout-webtummy-business[data-layout-family="HERO"] .banner-bg-11{height:auto;min-height:560px;display:flex;align-items:center;padding:64px 0}
.wt-layout-webtummy-business[data-layout-family="HERO"] .rts-banner-twelve-area{padding:0}
.wt-layout-webtummy-business[data-layout-family="HERO"] .rts-banner-twelve-area .title-main{font-size:clamp(32px,4vw,64px);margin-top:16px;margin-bottom:24px}
@media(max-width:767px){.wt-layout-webtummy-business[data-layout-family="HERO"] .banner-bg-11{min-height:420px;padding:48px 0}}
`
  if (config.theme === 'webtummy-business') styles += `\n.wt-layout-webtummy-business[data-layout-family="ABOUT"] .image-area-about-12{max-width:520px;margin:0 auto 24px}
.wt-layout-webtummy-business[data-layout-family="ABOUT"] .image-area-about-12 .thumbnail-large{width:calc(100% - 48px)}
.wt-layout-webtummy-business[data-layout-family="ABOUT"] .image-area-about-12 .thumbnail-large img{width:100%;height:340px;object-fit:cover}
.wt-layout-webtummy-business[data-layout-family="ABOUT"] .image-area-about-12 .thumbnail-small{width:46%;left:0;right:auto;bottom:-24px}
.wt-layout-webtummy-business[data-layout-family="ABOUT"] .image-area-about-12 .thumbnail-small img{width:100%;height:180px;object-fit:cover}
.wt-layout-webtummy-business[data-layout-family="ABOUT"] .rts-about-area-start.rts-section-gap{padding-top:72px;padding-bottom:72px}
.wt-layout-webtummy-business .rts-business-case-area .container-2{max-width:1200px;width:calc(100% - 48px);margin-left:auto;margin-right:auto}
.wt-layout-webtummy-business .mySwiperh3_business-case{overflow:visible}
.wt-layout-webtummy-business .mySwiperh3_business-case .swiper-wrapper{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:24px;overflow:visible}
.wt-layout-webtummy-business .mySwiperh3_business-case .swiper-slide{width:100%;min-width:0}
.wt-layout-webtummy-business .mySwiperh3_business-case .thumbnail{background:var(--awb-surface,#fff);border:1px solid var(--awb-border,#e5e7eb);border-radius:12px}
.wt-layout-webtummy-business .mySwiperh3_business-case .thumbnail>img{width:100%;height:240px;object-fit:cover;display:block;border-radius:12px 12px 0 0}
.wt-layout-webtummy-business .mySwiperh3_business-case .thumbnail .content{padding:24px;min-height:126px}
.wt-layout-webtummy-business .mySwiperh3_business-case .thumbnail .content .title{font-size:22px;line-height:1.35}
.wt-layout-webtummy-business .mySwiperh3_business-case .content-wrap::after{display:none}
.wt-layout-webtummy-business .mySwiperh3_business-case .thumbnail:hover img{filter:none}
@media(max-width:991px){.wt-layout-webtummy-business[data-layout-family="ABOUT"] .image-area-about-12{margin-top:32px}.wt-layout-webtummy-business .mySwiperh3_business-case .swiper-wrapper{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:767px){.wt-layout-webtummy-business[data-layout-family="ABOUT"] .image-area-about-12 .thumbnail-large img{height:260px}.wt-layout-webtummy-business[data-layout-family="ABOUT"] .image-area-about-12 .thumbnail-small img{height:140px}.wt-layout-webtummy-business[data-layout-family="ABOUT"] .rts-about-area-start.rts-section-gap{padding-top:48px;padding-bottom:48px}.wt-layout-webtummy-business .mySwiperh3_business-case .swiper-wrapper{grid-template-columns:minmax(0,1fr)}.wt-layout-webtummy-business .mySwiperh3_business-case .thumbnail>img{height:220px}}
`
  styles += `\n${scope}[data-layout-family="HEADER"] .mainmenu a::before,${scope}[data-layout-family="HEADER"] .mainmenu a::after,${scope}[data-layout-family="HEADER"] .mainmenu li::before,${scope}[data-layout-family="HEADER"] .mainmenu li::after,${scope}[data-layout-family="HEADER"] .wt-layout-dropdown summary::before,${scope}[data-layout-family="HEADER"] .wt-layout-dropdown summary::after,${scope}[data-layout-family="HEADER"] .wt-layout-submenu a::before,${scope}[data-layout-family="HEADER"] .wt-layout-submenu a::after{content:none!important;display:none!important}`
  styles += `\n${scope}[data-layout-family="HEADER"] .wt-layout-dropdown{position:relative}
${scope}[data-layout-family="HEADER"] .wt-layout-dropdown[open]>summary{margin-bottom:0}
${scope}[data-layout-family="HEADER"] .wt-layout-dropdown>summary{padding:12px 0;cursor:pointer;color:inherit;font-size:16px;white-space:nowrap}
${scope}[data-layout-family="HEADER"] .wt-layout-dropdown .wt-layout-submenu{position:absolute;left:0;top:100%;z-index:100;display:grid!important;gap:0;list-style:none;margin:0;padding:6px;width:280px;max-width:calc(100vw - 40px);max-height:70vh;overflow:auto;background:var(--awb-bg,#fff);color:var(--awb-fg,#102a43);border:1px solid var(--awb-border,#e5e7eb);border-radius:12px;box-shadow:0 12px 32px #0002}
${scope}[data-layout-family="HEADER"] .wt-layout-submenu li{margin:0;padding:0;width:100%}
${scope}[data-layout-family="HEADER"] .wt-layout-submenu li a{display:block;padding:8px 12px!important;line-height:1.35;height:auto;min-height:0;font-size:15px;white-space:normal}
${scope}[data-layout-family="HEADER"] .wt-layout-submenu a:hover,${scope}[data-layout-family="HEADER"] .wt-layout-submenu a:focus-visible{background:var(--awb-surface,#f5f5f5);border-radius:6px}
${scope} .wt-layout-mobile-menu .wt-layout-dropdown .wt-layout-submenu{position:static;width:100%;max-height:none;box-shadow:none;margin:4px 0 12px}
[data-layout-family="FOOTER"]>footer{background:var(--awb-surface,#fff)!important;color:var(--awb-fg,#102a43)!important;border-top:1px solid var(--awb-border,#e5e7eb)!important}
`
  if (config.theme === 'webtummy-business') styles += `\n.wt-layout-webtummy-business[data-layout-family="CONTACT"] .contact-one{padding:64px 0}
.wt-layout-webtummy-business[data-layout-family="CONTACT"] .contact-one::before,.wt-layout-webtummy-business[data-layout-family="CONTACT"] .contact-one::after,.wt-layout-webtummy-business .contact-form-area-one::before,.wt-layout-webtummy-business .contact-form-area-one::after{display:none}
.wt-layout-webtummy-business[data-layout-family="CONTACT"] .contact-one>.container>.row{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:32px;align-items:stretch!important;margin:0}
.wt-layout-webtummy-business[data-layout-family="CONTACT"] .contact-one>.container>.row>[class*="col-"]{width:auto;padding:0;min-width:0}
.wt-layout-webtummy-business[data-layout-family="CONTACT"] .contact-image-one{height:100%;margin:0}
.wt-layout-webtummy-business[data-layout-family="CONTACT"] .contact-image-one img{width:100%;height:100%;max-height:720px;object-fit:cover;display:block;border-radius:16px}
.wt-layout-webtummy-business[data-layout-family="CONTACT"] .contact-form-area-one{padding:32px;border-radius:16px;height:100%;box-shadow:none;background:var(--awb-surface,#fff)}
.wt-layout-webtummy-business[data-layout-family="CONTACT"] .contact-form-area-one form{padding:0!important;border:0!important;box-shadow:none!important;background:transparent!important;margin-top:24px;gap:16px!important}
.wt-layout-webtummy-business[data-layout-family="CONTACT"] .contact-form-area-one form input{margin-bottom:0;height:46px}
.wt-layout-webtummy-business[data-layout-family="CONTACT"] .contact-form-area-one form textarea{height:112px}
.wt-layout-webtummy-business[data-layout-family="CONTACT"] .contact-form-area-one .title{font-size:clamp(28px,3vw,40px);line-height:1.2}
.wt-layout-webtummy-business[data-layout-family="HERO"] .rts-breadcrumb-area{padding:64px 0;background-color:#102a43;background-blend-mode:multiply}
.wt-layout-webtummy-business[data-layout-family="HERO"] .rts-breadcrumb-area .title{font-size:clamp(30px,4vw,52px)}
.wt-layout-webtummy-business[data-layout-family="ABOUT"] .rts-about-area{padding:64px 0}
.wt-layout-webtummy-business .about-image-v-inner .image-area{min-height:360px;margin-bottom:24px}
.wt-layout-webtummy-business .about-image-v-inner .image-area .img-1{width:80%;height:340px;object-fit:cover;margin-top:0!important;border:0;padding:0;border-radius:12px}
.wt-layout-webtummy-business .about-image-v-inner .image-area .img-over{width:45%;height:180px;object-fit:cover;top:auto;bottom:0;right:0;animation:none;border-radius:12px}
.wt-layout-webtummy-business .about-image-v-inner .goal-button-wrapper{display:none}
.wt-layout-webtummy-business .about-progress-inner .meter{display:none}
.wt-layout-webtummy-business .about-progress-inner .single-progress{margin-bottom:12px}
.wt-layout-webtummy-business .about-service-width-controler{max-width:1200px;width:calc(100% - 48px);padding:0}
.wt-layout-webtummy-business .background-service.service-three{background-image:none!important;background:transparent;padding:0;margin:0}
.wt-layout-webtummy-business .service-one-inner-four .big-thumbnail-area{border:1px solid var(--awb-border,#e5e7eb);border-radius:12px;overflow:hidden;background:var(--awb-surface,#fff)}
.wt-layout-webtummy-business .service-one-inner-four .big-thumbnail-area .thumbnail img{height:220px;object-fit:cover}
.wt-layout-webtummy-business .service-one-inner-four .big-thumbnail-area .content{position:static;height:auto;min-height:220px;padding:24px;background:var(--awb-surface,#fff);color:var(--awb-fg,#102a43);transform:none!important}
.wt-layout-webtummy-business .service-one-inner-four .big-thumbnail-area .content .title{font-size:22px;color:inherit}
.wt-layout-webtummy-business .service-one-inner-four .big-thumbnail-area .content .disc{color:inherit;margin-bottom:0}
.wt-layout-webtummy-business .service-one-inner-four .big-thumbnail-area .content>img{width:40px;height:40px;object-fit:contain;margin-bottom:16px}
.wt-layout-webtummy-business .service-one-inner-four .rts-btn{margin-top:16px}
.wt-layout-webtummy-business[data-layout-family="SERVICES"] .rts-service-area{padding-top:64px;padding-bottom:64px;background-image:none!important}
.wt-layout-webtummy-business .padding-controler.service>[class*="col-"]{padding-bottom:24px!important}
.wt-layout-webtummy-business .service-two-inner{height:100%;border:1px solid var(--awb-border,#e5e7eb);border-radius:12px;overflow:hidden;background:var(--awb-surface,#fff)}
.wt-layout-webtummy-business .service-two-inner>.thumbnail{display:block}
.wt-layout-webtummy-business .service-two-inner>.thumbnail img{width:100%;height:220px;object-fit:cover}
.wt-layout-webtummy-business .service-two-inner .body-content{position:static;width:auto;margin:0;padding:24px;transform:none!important;background:transparent;box-shadow:none}
.wt-layout-webtummy-business .service-two-inner .hidden-area{height:auto!important;max-height:none!important;opacity:1!important;visibility:visible!important;overflow:visible!important;transform:none!important}
.wt-layout-webtummy-business .service-two-inner .body-content .title{font-size:22px;line-height:1.3}
.wt-layout-webtummy-business[data-layout-family="FAQ"] .rts-section-gap{padding:64px 0;background-image:none!important;background:var(--awb-surface,#fff)}
.wt-layout-webtummy-business .thumbnail-faq-four img{width:100%;max-height:460px;object-fit:cover;border-radius:16px}
.wt-layout-webtummy-business details.accordion-item>.accordion-button{display:block;padding:20px;white-space:normal;font-size:17px;line-height:1.4}
.wt-layout-webtummy-business details.accordion-item>.accordion-button::after{display:none}
.wt-layout-webtummy-business details.accordion-item .accordion-body{padding:0 20px 20px;line-height:1.6}
@media(max-width:991px){.wt-layout-webtummy-business[data-layout-family="CONTACT"] .contact-one>.container>.row{grid-template-columns:minmax(0,1fr)}.wt-layout-webtummy-business[data-layout-family="CONTACT"] .contact-image-one img{height:300px}.wt-layout-webtummy-business .thumbnail-faq-four{margin-top:32px}}
@media(max-width:767px){.wt-layout-webtummy-business[data-layout-family="CONTACT"] .contact-one{padding:48px 0}.wt-layout-webtummy-business[data-layout-family="CONTACT"] .contact-form-area-one{padding:24px}.wt-layout-webtummy-business .about-image-v-inner .image-area{min-height:280px}.wt-layout-webtummy-business .about-image-v-inner .image-area .img-1{height:260px}.wt-layout-webtummy-business .about-image-v-inner .image-area .img-over{height:140px}}
`
  if (config.theme === 'webtummy-business') styles += `\n.wt-layout-webtummy-business .about-progress-inner .inner .rts-progress-one-wrapper .meter{display:none!important}
.wt-layout-webtummy-business .about-progress-inner .inner .rts-progress-one-wrapper{padding:24px;border-radius:12px}
.wt-layout-webtummy-business .service-one-inner-four .big-thumbnail-area::after,.wt-layout-webtummy-business .service-one-inner-four .big-thumbnail-area::before,.wt-layout-webtummy-business .service-one-inner-four .big-thumbnail-area .content::after,.wt-layout-webtummy-business .service-one-inner-four .big-thumbnail-area .content::before{display:none!important}
.wt-layout-webtummy-business .service-one-inner-four .big-thumbnail-area .content p.disc{color:var(--awb-fg,#102a43)!important}
.wt-layout-webtummy-business .service-one-inner-four .big-thumbnail-area .content,.wt-layout-webtummy-business .service-one-inner-four .big-thumbnail-area:hover .content{height:auto;overflow:visible}
.wt-layout-webtummy-business .rts-title-area.service-four::after{display:none}
.wt-layout-webtummy-business[data-layout-family="FAQ"] .rts-section-gap{background-image:none!important;background-color:var(--awb-surface,#fff)!important;color:var(--awb-fg,#102a43)}
.wt-layout-webtummy-business[data-layout-family="FAQ"] .title,.wt-layout-webtummy-business[data-layout-family="FAQ"] .sm-title{color:var(--awb-fg,#102a43)!important}
.wt-layout-webtummy-business[data-layout-family="FAQ"] .sm-title{display:block}
.wt-layout-webtummy-business .rts-faq-section .row:not(:has(.thumbnail-faq-four img))>.col-lg-6:has(.faq-two-inner){width:100%;max-width:900px;margin:0 auto}
.wt-layout-webtummy-business .rts-faq-section .row>.col-lg-6:not(:has(.faq-two-inner)):not(:has(img)){display:none}
.wt-layout-webtummy-business .accordion-service-inner{background-image:none!important;background-color:transparent!important;padding:0!important}
.wt-layout-webtummy-business .accordion-service-inner .accordion-area{padding:0;max-width:900px}
.wt-layout-webtummy-business details.accordion-item{margin:0 0 12px!important;background:var(--awb-bg,#fff);border:1px solid var(--awb-border,#e5e7eb);border-radius:10px;overflow:hidden}
.wt-layout-webtummy-business details.accordion-item>.accordion-button{margin:0;background:transparent!important;color:var(--awb-fg,#102a43)!important;box-shadow:none;font-weight:600}
.wt-layout-webtummy-business details.accordion-item .accordion-body{color:var(--awb-fg,#102a43);background:transparent}
`
  if (config.theme === 'webtummy-business') styles += `\n.wt-layout-webtummy-business .rts-title-area.contact::before,.wt-layout-webtummy-business .rts-title-area.contact::after{display:none!important}
`
  if (config.theme === 'webtummy-business') styles += `\n.wt-layout-webtummy-business[data-layout-family="FAQ"] .accordion-service-bg{background-image:none!important;padding:0!important}
.wt-layout-webtummy-business .accordion-service-bg .row>.col-xl-6{width:100%;max-width:900px;margin:0 auto}
.wt-layout-webtummy-business details.accordion-item{padding:0!important;min-height:0!important;height:auto!important}
.wt-layout-webtummy-business details.accordion-item>summary.accordion-button{padding:20px!important;min-height:0!important;height:auto!important;border-radius:0;white-space:normal}
.wt-layout-webtummy-business details.accordion-item .wt-layout-faq-label{display:flex;gap:8px;align-items:baseline}
.wt-layout-webtummy-business .accordion-service-inner .accordion-area .accordion-item::before{display:none}
`
  if (config.theme === 'webtummy-business') styles += `\n.wt-layout-webtummy-business details.accordion-item{background:var(--awb-bg,#fff)!important;border:1px solid var(--awb-border,#ddd)!important;border-radius:10px!important}
.wt-layout-webtummy-business details.accordion-item::before,.wt-layout-webtummy-business details.accordion-item::after,.wt-layout-webtummy-business details.accordion-item>summary.accordion-button::before{display:none!important}
.wt-layout-webtummy-business details.accordion-item>summary.accordion-button{position:relative;padding-right:56px!important}
.wt-layout-webtummy-business details.accordion-item>summary.accordion-button::after{content:'+'!important;display:block!important;position:absolute;right:20px;top:20px;width:auto;height:auto;background:none!important;transform:none!important;border:0;color:inherit;font:22px/1 Arial,sans-serif}
.wt-layout-webtummy-business details.accordion-item[open]>summary.accordion-button::after{content:'−'!important}
`
  if (config.theme === 'webtummy-business') styles += `\n@media(min-width:768px) and (max-width:991px){.wt-layout-webtummy-business[data-layout-family="CONTACT"] .contact-one>.container>.row{grid-template-columns:repeat(2,minmax(0,1fr));gap:24px}.wt-layout-webtummy-business[data-layout-family="CONTACT"] .contact-image-one img{height:100%;max-height:none}.wt-layout-webtummy-business[data-layout-family="CONTACT"] .contact-form-area-one{padding:24px}}
`
  if (config.theme === 'webtummy-business') styles += `\n@media(min-width:480px) and (max-width:991px){.wt-layout-webtummy-business[data-layout-family="CONTACT"] .contact-one>.container>.row{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:20px}.wt-layout-webtummy-business[data-layout-family="CONTACT"] .contact-one>.container>.row>[class*="col-"]{width:auto!important;min-width:0}.wt-layout-webtummy-business[data-layout-family="CONTACT"] .contact-image-one img{height:100%;max-height:none}.wt-layout-webtummy-business[data-layout-family="CONTACT"] .contact-form-area-one{padding:20px}}
@media(min-width:480px) and (max-width:767px){.wt-layout-webtummy-business[data-layout-family="CONTACT"] .contact-form-area-one{padding:16px}.wt-layout-webtummy-business[data-layout-family="CONTACT"] .contact-form-area-one .title{font-size:24px}.wt-layout-webtummy-business[data-layout-family="CONTACT"] .contact-form-area-one .pre-title{font-size:12px;letter-spacing:.05em}.wt-layout-webtummy-business[data-layout-family="CONTACT"] .contact-one>.container>.row{gap:16px}}
`
  if (config.theme === 'webtummy-business') styles += `\n.wt-layout-webtummy-business[data-layout-family="CONTACT"] .contact-one>.container>.row{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:clamp(12px,2.5vw,32px)!important}
.wt-layout-webtummy-business[data-layout-family="CONTACT"] .contact-one>.container>.row>[class*="col-"]{width:auto!important;min-width:0}
.wt-layout-webtummy-business[data-layout-family="CONTACT"] .contact-one .contact-image-one img{height:100%;max-height:none;object-fit:cover}
.wt-layout-webtummy-business[data-layout-family="CONTACT"] .contact-one .contact-form-area-one{padding:clamp(12px,2.5vw,32px);min-width:0;overflow-wrap:anywhere}
@media(max-width:479px){.wt-layout-webtummy-business[data-layout-family="CONTACT"] .contact-one>.container{padding-left:12px;padding-right:12px}.wt-layout-webtummy-business[data-layout-family="CONTACT"] .contact-one .contact-form-area-one .title{font-size:20px}.wt-layout-webtummy-business[data-layout-family="CONTACT"] .contact-one .contact-form-area-one .pre-title{font-size:10px;letter-spacing:.02em}.wt-layout-webtummy-business[data-layout-family="CONTACT"] .contact-one .contact-form-area-one form{gap:12px!important}.wt-layout-webtummy-business[data-layout-family="CONTACT"] .contact-one .contact-form-area-one form button{padding:12px 8px!important;font-size:12px;letter-spacing:0}.wt-layout-webtummy-business[data-layout-family="CONTACT"] .contact-one .contact-form-area-one form legend{font-size:12px}}
`
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
    decl.value=decl.value.replace(/#[0-9a-f]{3,8}\b/gi,color=>{
      const role=brandColorRoles[color.toLowerCase()]
      return role?`var(--awb-${({foreground:'fg',background:'bg'})[role]||role},${color})`:color
    })
    if (/(?:^|-)animation(?:-name)?$/.test(decl.prop)) decl.value=decl.value.replace(/[A-Za-z_][\w-]*/g,word=>animations.get(word) || word)
  })
  fs.writeFileSync(path.join(library,config.theme,'editable.css'),scopedCss.toString())
}
fs.mkdirSync(path.join(root,'packages/component-registry/src/imported'),{recursive:true})
fs.writeFileSync(path.join(root,'packages/component-registry/src/imported/layouts.json'),JSON.stringify(output))
fs.writeFileSync(path.join(root,'packages/component-registry/src/imported/decorative-icons.json'),JSON.stringify(compileDecorativeIcons(output.sections,library)))
fs.writeFileSync(path.join(root,'packages/shared/src/layout-catalogue.json'),JSON.stringify(output.templates.map(({id,theme,name,category,preview,thumbnail})=>({id,theme,name,category,preview,thumbnail})),null,2))
console.log(`Compiled ${output.templates.length} layouts and ${output.sections.length} editable sections`)

// Keep gallery previews on the same renderer as generated websites.
if (process.env.SKIP_TEMPLATE_PREVIEWS !== '1') {
  const previewBuild = require('node:child_process').spawnSync(process.execPath, ['--import', 'tsx', path.join(root, 'scripts/build-template-previews.tsx')], { cwd: root, stdio: 'inherit' })
  if (previewBuild.status !== 0) throw new Error('Webtummy template preview build failed')
}
