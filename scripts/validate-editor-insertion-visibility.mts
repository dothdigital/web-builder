import assert from 'node:assert/strict'
import {build} from 'esbuild'
const {chromium}=await import('/tmp/webtummy-ui-check/node_modules/playwright/index.mjs')
const bundle=await build({stdin:{contents:"import {revealEditorElement} from './apps/web/src/lib/reveal-editor-element';window.reveal=revealEditorElement",resolveDir:process.cwd(),loader:'ts'},bundle:true,write:false,format:'iife'})
const browser=await chromium.launch({headless:true,args:['--no-sandbox'],env:{...process.env,LD_LIBRARY_PATH:'/tmp/webtummy-browser-libs/root/usr/lib/x86_64-linux-gnu'}})
try{
 const page=await browser.newPage({viewport:{width:1200,height:800},reducedMotion:'reduce'})
 await page.setContent(`<div data-awb-canvas-scroll style="height:500px;overflow:auto"><div data-awb-selected-frame="true" data-awb-section-id="previous"><h2 data-awb-element="/items/0">Previous section</h2></div><div style="height:2400px"></div><div data-awb-section-id="new"><h2 data-awb-element="/items/0" style="display:none">Hidden template duplicate</h2><h2 data-awb-element="/items/0">Your heading</h2><div role="img" data-awb-element="/items/1" style="height:120px">Empty image</div></div><div style="height:700px"></div></div>`)
 await page.addScriptTag({content:bundle.outputFiles[0]!.text})
 const viewport=await page.locator('[data-awb-canvas-scroll]').boundingBox()
 for(const path of [undefined,'/items/0','/items/1']){
  await page.locator('[data-awb-canvas-scroll]').evaluate(el=>el.scrollTop=0)
  await page.evaluate(path=>(window as any).reveal(path,'new'),path)
  await page.waitForTimeout(80)
  const target=path? page.locator(`[data-awb-section-id="new"] [data-awb-element="${path}"]:visible`):page.locator('[data-awb-section-id="new"]')
  const bounds=(await target.boundingBox())!
  assert.ok(bounds.y>=viewport!.y && bounds.y+bounds.height<=viewport!.y+viewport!.height,'New section/object must be inside canvas viewport')
  assert.ok(await page.locator('[data-awb-canvas-scroll]').evaluate(el=>el.scrollTop)>2000,'Scroll to new section instead of the old selection')
 }
 console.log('PASS: new sections, headings and image placeholders are revealed in the canvas, despite an old selection and duplicate hidden paths.')
}finally{await browser.close()}
