import assert from 'node:assert/strict'
import React from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
import {getComponent,defaultTokens} from '@awb/component-registry'
import {addManualObject} from '../apps/web/src/lib/add-manual-object'
import type {WebsiteSection} from '@awb/website-model'
Object.assign(globalThis,{React})
const definition=getComponent('ManualSection')!
for(const columns of [undefined,1,2,5]){
 let section:WebsiteSection={id:'new',componentId:'ManualSection',componentVersion:'1.0.0',hidden:false,props:{items:[],...(columns?{sectionColumns:columns}:{})}}
 for(const [kind,column] of [['heading',columns??1],['text',1],['image',1],['button',1],['form',1]] as const){
  const result=addManualObject(section,kind,kind,0,{column});section=result.section
 }
 const props=definition.propsSchema.parse(section.props)
 const html=renderToStaticMarkup(React.createElement(definition.render,{props,context:{tokens:defaultTokens,baseUrl:'',editing:true}}))
 assert.ok(html.includes('Your heading'))
 assert.ok(html.includes('Write your content here.'))
 assert.ok(html.includes('Empty image'))
 assert.ok(html.includes('Learn more'))
 assert.ok(html.includes('Submit'))
 assert.equal(html.includes('data-awb-columns-grid'),columns!==undefined)
 assert.equal((section.props.items as any[]).length,5)
 if(!columns)assert.equal((props as any).sectionColumns,undefined)
}
console.log('PASS: headings, paragraphs, images, buttons and forms render in plain blank sections; optional 1, 2 and 5 column layouts still work.')
