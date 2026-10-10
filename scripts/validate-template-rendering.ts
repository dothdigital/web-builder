import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { JSDOM } from 'jsdom'
import { defaultTokens, getComponent, importedTemplates, templateServiceCards } from '@awb/component-registry'
import layouts from '../packages/component-registry/src/imported/layouts.json'
import { ensureServiceDetailPages, ensureContactPageLayout, emptyImagePointers } from '@awb/component-registry'

Object.assign(globalThis, { React })
function render(componentId: string, props: Record<string, unknown>, serviceLinks: Array<{label:string;href:string}> = [], tokens=defaultTokens) {
  const definition = getComponent(componentId)!
  return new JSDOM(renderToStaticMarkup(React.createElement(definition.render, {
    props: definition.propsSchema.parse(props),
    context: { tokens, baseUrl: '/preview/test',serviceLinks },
  }))).window.document
}

for (const template of importedTemplates) {
  const header = render(template.header, {
    logoText: 'Example business', items: [{ label: 'Contact', href: '/contact' }],
  })
  assert.ok(header.querySelector('[data-layout-family="HEADER"]'), template.id)
  assert.ok(header.querySelector('[data-awb-element="/logoText"]'),`${template.id}: logo must remain visible`)
  assert.ok(header.querySelector('a[href="/preview/test/contact"]'), template.id)
  const brandTokens={...defaultTokens,palette:{...defaultTokens.palette,primary:'#0269c2',accent:'#53b849'}}
  const branded=render(template.header,{logoText:'Example business',items:[]},[],brandTokens)
  const wrapper=branded.querySelector('[data-layout-family="HEADER"]') as HTMLElement
  assert.equal(wrapper.style.getPropertyValue('--color-primary'),'#0269c2',`${template.id}: selected brand colour must override demo variables`)
  assert.equal(wrapper.style.getPropertyValue('--awb-accent'),'#53b849',`${template.id}: selected accent must be available to decorative icons`)
  const footer = render(template.footer, { businessName:'Example business',email:'hello@example.com',phone:'1234567890',columns:[{title:'Pages',items:[{label:'About',href:'/about'}]}] })
  assert.equal(footer.querySelectorAll('form').length,0,template.id)
  assert.ok(footer.querySelector('a[href="mailto:hello@example.com"]'),template.id)
  assert.ok(footer.querySelector('a[href="tel:1234567890"]'),template.id)
  assert.ok(footer.querySelector('a[href="/preview/test/about"]'),template.id)
  for (const componentId of template.home) {
    const section = layouts.sections.find(section => section.componentId === componentId)!
    if (section.family === 'FOOTER' || section.family === 'HEADER') continue
    const doc = render(componentId, section.fixture)
    for (const slide of doc.querySelectorAll('.swiper-slide')) {
      assert.ok(slide.classList.contains('swiper-slide-active'), componentId)
      assert.equal(slide.hasAttribute('data-layout-carousel'), false, componentId)
    }
    for (const field of section.fields.filter(field=>getComponent(componentId)!.editorFields.some(editable=>editable.path===field.path))) {
      if (field.type !== 'text' && field.type !== 'textarea') continue
      assert.ok(doc.querySelector(`[data-awb-element="${field.path}"]`), `${componentId} ${field.path}`)
    }
  }
}

const header = render('Tpl_webtummy-business_12_0', { logoText: 'Example business', link0: '/', link1: '#', text0: '' })
assert.equal(header.querySelector('.quote-btn')?.textContent, 'Get in touch')
assert.equal(header.querySelector('.quote-btn')?.getAttribute('href'), '/preview/test/contact')
const hero = render('Tpl_webtummy-business_12_1', { heading: 'Coverage guidance', text4: 'Request information', link0: '#' })
assert.equal(hero.querySelector('h1[data-awb-element="/heading"]')?.textContent?.trim(), 'Coverage guidance')
assert.equal(hero.querySelector('.quote-btn')?.getAttribute('href'), '/preview/test/contact')
const process = render('Tpl_webtummy-business_12_5', { text3: 'Understand your needs' })
const heading = process.querySelector('[data-awb-element="/text3"]')!
assert.equal(heading.tagName, 'H3')
assert.equal(process.querySelectorAll('.awb-guidance-card').length,4)
assert.equal(process.querySelectorAll('.single-steps-area-nine').length,0)
assert.equal(heading.children.length, 0, 'Card heading must not receive nested badge spans')
const dropdown = render('Tpl_webtummy-business_12_0',{items:[{label:'Services',href:'/services',children:[{label:'Life insurance',href:'/services#life'}]}]})
assert.ok(dropdown.querySelector('details.wt-layout-dropdown>summary'))
assert.ok(dropdown.querySelector('details.wt-layout-dropdown a[href="/preview/test/services#life"]'))
const faq = render('Tpl_webtummy-business_about_5',layouts.sections.find(section=>section.componentId==='Tpl_webtummy-business_about_5')!.fixture)
assert.equal(faq.querySelectorAll('summary button').length,0,'Native FAQ disclosures must not contain inert buttons')
// Service routes are derived without overwriting pages or requiring AI calls.
const overview = layouts.sections.find(section=>section.componentId==='Tpl_webtummy-business_services_2')!
const serviceSource = {
  site:{name:'Example business'},pages:[{id:'services',path:'/services',title:'Services',h1:'Services',seo:{title:'Services',description:'Services',index:true},pageType:'SERVICES',sections:[{id:'cards',componentId:overview.componentId,componentVersion:'1.0.0',hidden:false,props:{...overview.fixture,text0:'Visitor insurance',text1:'Existing visitor coverage description.'}}]}],
  globalComponents:{header:{componentId:'Tpl_webtummy-business_12_0',componentVersion:'1.0.0',props:{items:[{label:'Services',href:'/services'}]}},footer:{componentId:'Tpl_webtummy-business_12_11',componentVersion:'1.0.0',props:{}}},
  navigation:{primaryMenu:[{label:'Services',linkType:'PAGE',pageId:'services',newTab:false,children:[]}],footerMenu:[],utilityMenu:[]},
} as unknown as Parameters<typeof ensureServiceDetailPages>[0]
const repaired = ensureServiceDetailPages(serviceSource)
const serviceDoc = render(overview.componentId,serviceSource.pages[0].sections[0].props,[{label:'Visitor insurance',href:'/services/visitor-insurance'}])
const learnMore = serviceDoc.querySelector('a[data-awb-link="/link1"]')!
assert.equal(learnMore.getAttribute('href'),'/preview/test/services/visitor-insurance','Replace overview self-links with the matching detail route')
assert.ok(repaired.pages.some(page=>page.path==='/services/visitor-insurance'))
assert.equal(repaired.pages.find(page=>page.path==='/services/visitor-insurance')?.sections[1].props.body,'Existing visitor coverage description.')
assert.equal(repaired.pages[0],serviceSource.pages[0],'Existing page layout must remain unchanged')
assert.deepEqual(ensureServiceDetailPages(repaired),repaired,'Repair must be idempotent')
for (const template of importedTemplates) {
  const ids = template.secondary.services
  const sections = ids.map(componentId=>layouts.sections.find(section=>section.componentId===componentId)!).filter(section=>section.family==='SERVICES')
  const cards = sections.flatMap(section=>templateServiceCards(section.componentId,section.fixture))
  assert.ok(cards.length>0,`${template.id}: missing service content extraction`)
  assert.ok(cards.every(card=>card.description.trim()),`${template.id}: service summaries must contain content`)
  const templateSource = {...serviceSource,pages:[{...serviceSource.pages[0],sections:sections.map(section=>({id:section.componentId,componentId:section.componentId,componentVersion:'1.0.0',hidden:false,props:section.fixture}))}]}
  const complete = ensureServiceDetailPages(templateSource)
  assert.ok(complete.pages.length>1,`${template.id}: service detail pages were not created`)
  assert.ok(complete.pages.slice(1).every(page=>String(page.sections[1].props.body).trim()),`${template.id}: empty service detail content`)
  const contactSections=template.secondary.contact.map(componentId=>layouts.sections.find(section=>section.componentId===componentId)!).filter(section=>!['HEADER','FOOTER'].includes(section.family))
  const contactSource={...serviceSource,contact:{phone:'1234567890',email:'hello@example.com',city:'Example City',hours:[]},pages:[{...serviceSource.pages[0],id:'contact',path:'/contact',sections:contactSections.map(section=>({id:section.componentId,componentId:section.componentId,componentVersion:'1.0.0',hidden:false,props:section.fixture}))}]}
  const contactModel=ensureContactPageLayout(contactSource)
  assert.equal(contactModel.pages[0].sections.filter(section=>section.componentId==='ContactSplit').length,1,template.id)
  assert.deepEqual(ensureContactPageLayout(contactModel),contactModel,'Contact repair must be idempotent')
  const contactSection=contactModel.pages[0].sections.find(section=>section.componentId==='ContactSplit')!
  assert.equal(contactSection.props.imageUrl,'',`${template.id}: no unrelated contact-card photo`)
  const contactDoc=render('ContactSplit',contactSection.props)
  assert.equal(contactDoc.querySelectorAll('form').length,1)
  assert.ok(contactDoc.querySelector('a[href="tel:1234567890"]'))
  assert.ok(contactDoc.querySelector('a[href="mailto:hello@example.com"]'))
  assert.equal(contactDoc.querySelectorAll('.awb-contact-layout img').length,0)
  assert.deepEqual(emptyImagePointers('ContactSplit',contactSection.props),[],'Optional contact photos must not be generated automatically')
}
const nativeSource = {...serviceSource,pages:[{...serviceSource.pages[0],sections:[{id:'native',componentId:'ServicesLargeNumbers',componentVersion:'1.0.0',hidden:false,props:{heading:'Services',items:[{title:'Example service',description:'Supplied service description.',href:'/services'}]}}]}]}
const nativeComplete = ensureServiceDetailPages(nativeSource)
assert.ok(nativeComplete.pages.some(page=>page.path==='/services/example-service'))
assert.equal((nativeComplete.pages[0].sections[0].props.items as Array<{href:string}>)[0].href,'/services/example-service')
console.log(`PASS: ${importedTemplates.length} template headers, home sections, editable text paths, static slides and CTA routing`)
