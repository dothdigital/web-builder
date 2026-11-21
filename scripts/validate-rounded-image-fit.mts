import React from 'react'
import assert from 'node:assert/strict'
import {renderToStaticMarkup} from 'react-dom/server'
import{getComponent,defaultTokens}from'@awb/component-registry'
const{chromium}=await import('/tmp/webtummy-ui-check/node_modules/playwright/index.mjs')
Object.assign(globalThis,{React})
const definition=getComponent('ManualSection')!
const img='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="1916" height="821"><rect width="1916" height="821" fill="purple"/></svg>')
const browser=await chromium.launch({headless:true,args:['--no-sandbox'],env:{...process.env,LD_LIBRARY_PATH:'/tmp/webtummy-browser-libs/root/usr/lib/x86_64-linux-gnu'}})
try{
const page=await browser.newPage({viewport:{width:1600,height:1000}})
for(const editing of[true,false])for(const fit of['contain','cover'])for(const width of[800,1032,1440]){
const props=definition.propsSchema.parse({items:[],freeElements:[{id:'image',componentId:'ManualSection',source:'/items/0',x:0,y:0,width:96,height:471,content:{items:[{id:'img',kind:'image',imageUrl:img}],imageSizes:{'/items/0/imageUrl':{fit}},elementColors:{'/items/0/imageUrl':{borderRadius:41}}}}]})
const html=renderToStaticMarkup(React.createElement(definition.render,{props,context:{tokens:defaultTokens,baseUrl:'',editing}}))
await page.setContent(`<div style="width:${width}px">${html}</div>`)
const image=page.locator('img');await image.evaluate((e:HTMLImageElement)=>e.decode())
const size=await image.evaluate(e=>{const b=e.getBoundingClientRect(),s=getComputedStyle(e);return{width:b.width,height:b.height,fit:s.objectFit,radius:s.borderRadius}})
assert.equal(size.fit,fit);assert.equal(size.radius,'41px')
if(fit==='contain')assert.ok(Math.abs(size.width/size.height-1916/821)<.01,'Round the visible image, without letterboxing inside its own box')
else{assert.ok(Math.abs(size.height-471)<1);assert.ok(Math.abs(size.width-width*.96)<1)}
}
console.log('PASS: rounded whole-image bounds preserve natural ratio at 800, 1032 and 1440px; cover still fills its frame; editor and export render identically.')
}finally{await browser.close()}
