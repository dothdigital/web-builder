import React from 'react'
import assert from 'node:assert/strict'
import { renderToStaticMarkup } from 'react-dom/server'
import { getComponent, defaultTokens, tokensToCssVars } from '@awb/component-registry'
const { chromium } = await import('/tmp/webtummy-ui-check/node_modules/playwright/index.mjs')
Object.assign(globalThis, { React })
const definition = getComponent('ManualSection')!
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'], env: { ...process.env, LD_LIBRARY_PATH: '/tmp/webtummy-browser-libs/root/usr/lib/x86_64-linux-gnu' } })
try {
 const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
 for (const count of [1, 2, 3, 4, 5]) {
  const props = definition.propsSchema.parse({ items: [{ id: 'columns', kind: 'columns', columns: Array.from({length:count}, (_,i) => ({title:`Column ${i+1}`, body:'Long content stays in its own column without overlapping.'})) }] })
  for (const editing of [true, false]) {
   const html = renderToStaticMarkup(React.createElement('div', { style: tokensToCssVars(defaultTokens) }, React.createElement(definition.render, { props, context: { tokens: defaultTokens, baseUrl: '', editing, staticRenderScope: 'object-layout' } })))
   await page.setContent(`<style>*{box-sizing:border-box}body{margin:0}</style>${html}`)
   const root=page.locator('[data-awb-element="/items/0"]')
   for (const width of [1100, 800, 600, 350, 160]) {
    await root.evaluate((element, width) => { (element as HTMLElement).style.width=width+'px' }, width)
    const boxes=await page.locator('[data-awb-object-columns]>div').evaluateAll(elements=>elements.map(element=>{const b=element.getBoundingClientRect();return {x:b.x,y:b.y,width:b.width,right:b.right}}))
    assert.equal(boxes.length,count)
    assert.ok(boxes.every(box=>Math.abs(box.y-boxes[0]!.y)<1), `${count} columns must stay on one row when resized to ${width}px`)
    assert.ok(boxes.every((box,i)=>i===0||box.x>=boxes[i-1]!.right-1),'Columns must not overlap')
   }
   await page.setViewportSize({width:375,height:1000})
   await root.evaluate(element=>{(element as HTMLElement).style.width='100%'})
   const mobile=await page.locator('[data-awb-object-columns]>div').evaluateAll(elements=>elements.map(element=>element.getBoundingClientRect().y))
   assert.ok(mobile.every((y,i)=>i===0||y>mobile[i-1]!),'Phone columns stack')
   await page.setViewportSize({width:1440,height:1000})
  }
 }
 console.log('PASS: 1–5 columns stay in one desktop row at widths 160–1100px, no overlap, phone stacking, editor and static export.')
} finally { await browser.close() }
