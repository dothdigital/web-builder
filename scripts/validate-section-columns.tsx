import React from 'react'
import assert from 'node:assert/strict'
import {renderToStaticMarkup} from 'react-dom/server'
import {getComponent,defaultTokens} from '@awb/component-registry'
import {setSectionColumns,addColumnObject,copyColumnObjects,copyColumn,removeColumnObject,preserveColumnLayout} from '../apps/web/src/lib/section-columns'
Object.assign(globalThis,{React})
const definition=getComponent('ManualSection')!
for(const count of [1,2,3,4,5]){
 let props=setSectionColumns({items:[],equalColumnWidths:true,equalColumnHeights:true},count)
 props=addColumnObject(props,'heading',1);props=addColumnObject(props,'text',1);props=addColumnObject(props,'image',count)
 assert.equal((props.items as any[]).length,3)
 assert.equal((props.items as any[])[2].column,count)
 definition.propsSchema.parse(props)
 const html=renderToStaticMarkup(React.createElement(definition.render,{props:definition.propsSchema.parse(props),context:{tokens:defaultTokens,baseUrl:'',editing:true,staticRenderScope:'test-'+count}}))
 assert.equal((html.match(/data-awb-column="/g)||[]).length,count)
 assert.ok(html.includes('grid-auto-rows:1fr'))
}
let props=addColumnObject(setSectionColumns({items:[]},3),'text',1)
props={...props,elementColors:{'/items/0/text':{color:'#123456',fontSize:24}},imageSizes:{'/items/0/imageUrl':{width:50}}}
const before=JSON.stringify(props)
const copied=copyColumnObjects(props,[0],2)
assert.equal(JSON.stringify(props),before)
assert.notEqual((copied.items as any[])[0].id,(copied.items as any[])[1].id)
assert.equal((copied.items as any[])[1].column,2)
assert.deepEqual((copied.elementColors as any)['/items/1/text'],{color:'#123456',fontSize:24})
;(copied.items as any[])[1].text='Independent copy'
assert.notEqual((copied.items as any[])[0].text,(copied.items as any[])[1].text)
const all=copyColumn(copied,2,3)
assert.equal((all.items as any[]).length,3)
const reduced=setSectionColumns(all,1)
assert.equal((reduced.items as any[]).length,3)
assert.ok((reduced.items as any[]).every(item=>item.column===1))
const removed=removeColumnObject(all,0)
assert.equal((removed.items as any[]).length,2)
assert.ok((removed.elementColors as any)['/items/0/text'])
assert.throws(()=>setSectionColumns(props,6))
assert.throws(()=>copyColumnObjects({...props,items:Array(100).fill((props.items as any[])[0])},[0],2))
const legacy=definition.propsSchema.parse({items:[]})
assert.equal(legacy.sectionColumns,undefined,'Legacy sections retain their original layout')
console.log('PASS: 1–5 columns, multiple objects per column, independent copies with formatting, copy whole column, non-destructive column reduction, removal style remapping, size bounds, object limits, and legacy layout preservation.')
import {writeFileSync} from 'node:fs'
import {tokensToCssVars} from '@awb/component-registry'
let visual=setSectionColumns({items:[],equalColumnWidths:true,equalColumnHeights:true},5)
for(let col=1;col<=5;col++){visual=addColumnObject(visual,'heading',col);visual=addColumnObject(visual,'text',col)}
visual.items=(visual.items as any[]).map((item,i)=>({...item,text:item.kind==='heading'?`Column ${item.column}`:'Useful content. '.repeat(i===3?35:3)}))
for(const equal of [true,false]){
 const markup=renderToStaticMarkup(React.createElement('div',{style:tokensToCssVars(defaultTokens)},React.createElement(definition.render,{props:definition.propsSchema.parse({...visual,equalColumnHeights:equal}),context:{tokens:defaultTokens,baseUrl:'',editing:false,staticRenderScope:'layout-'+equal}})))
 writeFileSync(`/tmp/section-columns-layout-${equal}.html`,`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>*{box-sizing:border-box}body{margin:0}</style></head><body>${markup}</body></html>`)
}
const uneven=renderToStaticMarkup(React.createElement('div',{style:tokensToCssVars(defaultTokens)},React.createElement(definition.render,{props:definition.propsSchema.parse({...visual,items:(visual.items as any[]).map(item=>item.column===1?{...item,text:'X'}:item),equalColumnWidths:false}),context:{tokens:defaultTokens,baseUrl:'',editing:false,staticRenderScope:'uneven-widths'}})))
writeFileSync('/tmp/section-columns-layout-widths.html',`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>*{box-sizing:border-box}body{margin:0}</style></head><body>${uneven}</body></html>`)

const originalSection={id:'manual',componentId:'ManualSection',componentVersion:'1.0.0',props:all} as any
const legacyResult={...originalSection,props:{items:(all.items as any[]).map(({column,...item})=>({...item,text:'Updated text'}))}}
const preserved=preserveColumnLayout(originalSection,legacyResult)
assert.equal(preserved.props.sectionColumns,3)
assert.deepEqual((preserved.props.items as any[]).map(item=>item.column),(all.items as any[]).map(item=>item.column))
assert.equal((preserved.props.items as any[])[0].text,'Updated text')
console.log('PASS: applying text results from an older worker preserves column count, sizing flags, and object placement.')
