import React from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
import {getComponent,defaultTokens} from '@awb/component-registry'
import assert from 'node:assert/strict'
import {htmlObjectTarget} from '../apps/web/src/lib/html-object'
import {editObjectProps} from '../apps/web/src/lib/object-editing'
const item={id:'html',kind:'embed',html:'<p>Existing</p>',css:'',javascript:'',height:300,column:3}
const props={items:[item]}
for(const path of ['/items/0','/items/0/html']){
 const target=htmlObjectTarget(props,path)!
 assert.equal(target.pointer,'/items/0')
 const next=editObjectProps(props,path,{type:'content',pointer:target.pointer,value:{...target.value,html:'<p>Pasted markup</p>',css:'p{color:red}',javascript:'document.body.dataset.ready="yes"'}})
 assert.equal((next.items as any[])[0].html,'<p>Pasted markup</p>')
 assert.equal((next.items as any[])[0].column,3)
 assert.equal(item.html,'<p>Existing</p>')
}
const moved={freeElements:[{id:'moved',componentId:'ManualSection',source:'/items/0',content:props,x:0,y:0,width:50,height:300}]}
for(const path of ['/freeElements/0','/freeElements/0/content/items/0']){
 const target=htmlObjectTarget(moved,path)!
 assert.equal(target.pointer,'/freeElements/0/content/items/0')
 const next=editObjectProps(moved,path,{type:'content',pointer:target.pointer,value:{...target.value,html:'<div>Moved HTML</div>'}})
 assert.equal((next.freeElements as any[])[0].content.items[0].html,'<div>Moved HTML</div>')
}
assert.equal(htmlObjectTarget({items:[{kind:'text'}]},'/items/0'),undefined)
Object.assign(globalThis,{React})
const definition=getComponent('ManualSection')!
const markup=renderToStaticMarkup(React.createElement(definition.render,{props:definition.propsSchema.parse(props),context:{tokens:defaultTokens,baseUrl:'',editing:true}}))
assert.match(markup,/data-awb-element="\/items\/0\/html"/,'HTML placeholder must select its semantic code field rather than an internal layout path')
console.log('PASS: HTML editing targets normal, column and moved objects; saves raw code to the correct object and preserves IDs, column placement and original data.')
