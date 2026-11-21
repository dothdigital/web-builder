import React from 'react'
import assert from 'node:assert/strict'
import { renderToStaticMarkup } from 'react-dom/server'
import { getComponent, defaultTokens, tokensToCssVars } from '@awb/component-registry'
import { annotateLayout } from '../packages/component-registry/src/layout-elements'
import { BalancedGrid } from '../packages/component-registry/src/balanced-grid'
const {chromium}=await import('/tmp/webtummy-ui-check/node_modules/playwright/index.mjs')
Object.assign(globalThis,{React})
const browser=await chromium.launch({headless:true,args:['--no-sandbox'],env:{...process.env,LD_LIBRARY_PATH:'/tmp/webtummy-browser-libs/root/usr/lib/x86_64-linux-gnu'}})
try {
 const page=await browser.newPage({viewport:{width:1440,height:1000}})
 for(const editing of [true,false]) for(const columns of [1,2,3,4]) {
  const def=getComponent('ServicesLargeNumbers')!
  const props=def.propsSchema.parse({...def.fixture,items:Array.from({length:4},(_,i)=>({title:`Quote ${i+1}`,href:'/quote'})),elementColors:{'/layout/0':{layoutColumns:columns,layoutGap:16,backgroundColor:'#abcdef'}}})
  const before=JSON.stringify(props)
  const html=renderToStaticMarkup(React.createElement('div',{style:tokensToCssVars(defaultTokens)},React.createElement(def.render,{props,context:{tokens:defaultTokens,baseUrl:'',editing,staticRenderScope:'quote-cards'}})))
  assert.equal(JSON.stringify(props),before,'Rendering must not modify saved props')
  await page.setContent(`<style>*{box-sizing:border-box}body{margin:0}</style>${html}`)
  const boxes=await page.locator('ol>li').evaluateAll(els=>els.map(e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width}}))
  assert.equal(boxes.filter(b=>Math.abs(b.y-boxes[0].y)<1).length,columns,`Desktop ${columns} columns editing=${editing}`)
  const section=await page.locator('section').evaluate(e=>({width:e.getBoundingClientRect().width,bg:getComputedStyle(e).backgroundColor}))
  assert.ok(section.width>1000,'Outer section must remain full width')
  assert.equal(section.bg,'rgb(171, 205, 239)')
  assert.equal(await page.locator('ol').evaluate(e=>getComputedStyle(e).gap),'16px')
  await page.setViewportSize({width:375,height:1000})
  const mobile=await page.locator('ol>li').evaluateAll(els=>els.map(e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right}}))
  assert.ok(mobile.every(b=>Math.abs(b.x-mobile[0].x)<1 && b.right<=375),'Mobile cards stack without horizontal overflow')
  await page.setViewportSize({width:1440,height:1000})
 }
 // Do not redirect an ambiguous section that contains two independent grids.
 const tree=annotateLayout(React.createElement('section',{},React.createElement(BalancedGrid,{count:1,scope:'one'},React.createElement('p',{},'one')),React.createElement(BalancedGrid,{count:1,scope:'two'},React.createElement('p',{},'two'))),{elementColors:{'/layout/0':{layoutColumns:2}}})
 const ambiguous=renderToStaticMarkup(tree)
 assert.ok(ambiguous.includes('repeat(6, minmax(0, 1fr))'),'Independent grids retain their original layouts')
 console.log('PASS: 1–4 card columns in editor/export, full-width section, preserved fill and gap, responsive mobile, immutable props, ambiguous grids unchanged.')
}finally{await browser.close()}
