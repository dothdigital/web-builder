import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { JSDOM } from 'jsdom'
import { defaultTokens, getComponent } from '@awb/component-registry'
import { elementColor, elementColorsSchema } from '../packages/component-registry/src/element-colors'
Object.assign(globalThis,{React})
const appearance={borderRadius:24,borderWidth:3,borderStyle:'solid',borderColor:'#445566',shadow:'medium'}
assert.ok(elementColorsSchema.safeParse({'/heading':appearance}).success)
assert.ok(!elementColorsSchema.safeParse({'/heading':{shadow:'url(evil)'}}).success)
const cases=[['HeroEditorial','/imageUrl'],['HeroEditorial','/heading'],['HeroEditorial','/primaryCta'],['HeaderTransparent','/logoImageUrl'],['FooterEditorial','/logoImageUrl'],['AboutSplitOverlap','/imageUrl']]
for(const [id,path] of cases){
 const definition=getComponent(id!)!
 const props=definition.propsSchema.parse({...definition.fixture as object,imageUrl:'/test.png',logoImageUrl:'/logo.png',elementColors:{[path!]:appearance}})
 const html=renderToStaticMarkup(React.createElement(definition.render,{props,context:{tokens:defaultTokens,baseUrl:''}}))
 const document=new JSDOM(html).window.document
 const element=document.querySelector<HTMLElement>(`[data-awb-element="${path}"]`)
 assert.ok(element,id+' editable target')
 assert.equal(element.style.borderRadius,'24px',id+' '+path+' rounded corners')
 assert.equal(element.style.borderWidth,'3px',id+' '+path+' border width')
 assert.equal(element.style.borderStyle,'solid',id+' '+path+' border style')
 assert.equal(path === '/heading' ? element.style.textShadow : element.style.boxShadow,'0 8px 24px rgba(0,0,0,0.18)',id+' '+path+' shadow')
 assert.ok(!element.hasAttribute('shadow'),'Preset is converted to CSS, not leaked to the DOM')
 if(element.parentElement?.hasAttribute('data-awb-image-container'))assert.equal(element.parentElement.style.boxShadow,'none','Image frame does not duplicate the shadow')
}
assert.equal(elementColor({elementColors:{'/heading':{shadow:'none'}}},'/heading').boxShadow,'none')
console.log('PASS: image, logo, text and button corners/borders/shadows survive schema validation and render in preview/export; image frames avoid duplicate shadows; unsafe shadow values are rejected.')

assert.equal(elementColor({elementColors:{'/heading':{shadow:'medium',shadowColor:'#336699',shadowDistance:12}}},'/heading').boxShadow,'0 12px 24px rgba(51,102,153,0.18)')
assert.ok(!elementColorsSchema.safeParse({'/heading':{shadowColor:'red',shadowDistance:101}}).success)

const raised=elementColor({elementColors:{'/heading':{shadow:'strong',shadowMode:'raised',shadowTarget:'text',shadowDistance:4,shadowColor:'#336699',shadowBlur:3,shadowOpacity:60}}},'/heading')
assert.equal(raised.boxShadow,'none');assert.equal(raised.textShadow,'0px -4px 3px rgba(51,102,153,0.6), 4px 0px 3px rgba(51,102,153,0.6), 0px 4px 3px rgba(51,102,153,0.6), -4px 0px 3px rgba(51,102,153,0.6)')
assert.equal(elementColor({elementColors:{'/imageUrl':{shadow:'soft',shadowAngle:180,shadowDistance:12}}},'/imageUrl').boxShadow,'-12px 0px 8px rgba(0,0,0,0.12)')
