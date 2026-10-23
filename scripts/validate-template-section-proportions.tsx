import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { JSDOM } from 'jsdom'
import { getComponent, defaultTokens, resolveBusinessContact } from '@awb/component-registry'
import type { WebsiteModel } from '@awb/website-model'
Object.assign(globalThis,{React})
const render = (id:string, input:Record<string,unknown>) => {
 const definition=getComponent(id)!
 return new JSDOM(renderToStaticMarkup(React.createElement(definition.render,{props:definition.propsSchema.parse({...definition.fixture,...input}),context:{tokens:defaultTokens,baseUrl:'',pagePath:'/',templateTheme:'webtummy-business'}}))).window.document
}
for(const [id,max] of [['Tpl_finbiz_1_2',320],['Tpl_finbiz_1_9',380]] as const){
 const doc=render(id,{imageUrl:'/tall-portrait.png'})
 const img=doc.querySelector('img[data-awb-element="/imageUrl"]') as HTMLImageElement
 assert.ok(img,id)
 assert.equal(img.style.maxHeight,`${max}px`,id)
 assert.equal(img.style.objectFit,'cover',id)
 assert.ok(img.style.height.includes('clamp'),id)
}
const source={pages:[{sections:[{id:'form',componentId:'Tpl_finbiz_1_12',hidden:false,props:{imageUrl:'/tall.png'}},{id:'info',componentId:'Tpl_finbiz_1_13',hidden:false,props:{text0:'Get in Touch',text1:'Questions',text2:'5551234',link0:'tel:5551234',text6:'Location',text7:'Based in',text8:'Brampton, Ontario'}}]}]} as unknown as WebsiteModel
const resolved=resolveBusinessContact(source)
assert.equal(source.pages[0]!.sections[1]!.hidden,false,'original content preserved')
assert.equal(resolved.pages[0]!.sections[1]!.hidden,true,'separate strip consumed once')
assert.deepEqual(resolveBusinessContact(resolved),resolved,'repeated resolution is stable')
const doc=render('Tpl_finbiz_1_12',resolved.pages[0]!.sections[0]!.props)
const panel=doc.querySelector('[data-awb-contact-form-panel]')!
const button=panel.querySelector('button[type="submit"]')!
const info=panel.querySelector('.awb-template-contact-details')!
assert.ok(info.textContent?.includes('Get in Touch'))
assert.ok(info.textContent?.includes('Brampton, Ontario'))
assert.ok(button.compareDocumentPosition(info)&4,'details follow the send button within the panel')
const image=doc.querySelector('[data-awb-contact-image-panel]') as HTMLElement
assert.equal(image.style.maxHeight,'480px')
assert.equal((image.querySelector('img') as HTMLElement).style.position,'absolute','intrinsic photo height cannot grow the grid')
console.log('PASS: biography/options inline image limits; contact photo cannot stretch grid; contact details follow submit within form panel, without duplication or source mutation')
