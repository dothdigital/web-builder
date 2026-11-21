import React from 'react'
import assert from 'node:assert/strict'
import {renderToStaticMarkup} from 'react-dom/server'
import {getComponent,defaultTokens} from '@awb/component-registry'
import {cardLinkContent,objectTextPointer,editObjectProps} from '../apps/web/src/lib/object-editing'
Object.assign(globalThis,{React})
const def=getComponent('ServicesLargeNumbers')!
const original={heading:'Get a quote',items:[{title:'Super Visa Insurance',href:'/super-visa-insurance'},{title:'Visitor Insurance',href:'/visitor-insurance'}]}
const path='/items/0/link'
assert.equal(objectTextPointer(original,path),path+'/label')
assert.deepEqual(cardLinkContent(original,path),{label:'Explore Super Visa Insurance →',href:'/super-visa-insurance',variant:'text-link'})
for(const variant of ['text-link','solid','outline']){
 let props=editObjectProps(original,path,{type:'content',pointer:path,value:{...cardLinkContent(original,path),variant}})
 props=editObjectProps(props,path,{type:'content',pointer:path+'/label',value:'Get a quote'})
 props=editObjectProps(props,path,{type:'content',pointer:path+'/href',value:'/quote'})
 const parsed=def.propsSchema.parse(JSON.parse(JSON.stringify(props)))
 assert.deepEqual((props.items as any[])[1],original.items[1], 'Other cards must remain unchanged')
 for(const editing of [true,false]){
  const html=renderToStaticMarkup(React.createElement(def.render,{props:parsed,context:{tokens:defaultTokens,baseUrl:'',editing,staticRenderScope:'link'}}))
  assert.match(html,/data-awb-element="\/items\/0\/link"/)
  assert.match(html,/href="\/quote"/)
  assert.match(html,/>Get a quote<\/a>/)
  assert.ok(html.includes(variant==='text-link'?'text-decoration:underline':'text-decoration:none'))
 }
}
const blank=def.propsSchema.parse(editObjectProps(original,path,{type:'content',pointer:path,value:{label:'Get a quote',href:'',variant:'solid'}}))
const blankHtml=renderToStaticMarkup(React.createElement(def.render,{props:blank,context:{tokens:defaultTokens,baseUrl:'',editing:true,staticRenderScope:'blank'}}))
assert.ok(blankHtml.includes('data-awb-element="/items/0/link"'),'Clearing a destination keeps the button editable')
assert.equal((original.items[0] as any).link,undefined)
console.log('PASS: separate selectable link, legacy fallback, button variants, independent label/destination, schema JSON roundtrip, editor/export, other cards unchanged.')
