import assert from 'node:assert/strict'
import { build } from 'esbuild'
const { chromium } = await import('/tmp/webtummy-ui-check/node_modules/playwright/index.mjs')
const bundle = await build({stdin:{contents:`
import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import {ImageResizeHandle} from './apps/web/src/app/projects/[id]/editor/image-resize-handle';
import {editObjectProps} from './apps/web/src/lib/object-editing';
import {applyElementOffsets} from './packages/component-registry/src/element-offsets';
import {elementColor} from './packages/component-registry/src/element-colors';
import {FreeLayout} from './packages/component-registry/src/free-elements';
function App(){
 const mode=new URLSearchParams(location.search).get('mode'),free=mode==='free',text=mode==='text',img=mode==='image';
 const [node,setNode]=useState(null),[props,setProps]=useState(free?{freeElements:[{id:'one',componentId:'Test',source:'/layout/0',content:{},x:10,y:60,width:50,height:240}]}:{elementOffsets:{'/target':{x:12,y:25}}});
 const path=free?'/freeElements/0':'/target';
 const commit=value=>{window.commits=(window.commits||0)+1;setProps(prev=>editObjectProps(prev,path,{type:img?'imageSize':'style',value}));};
 const tag=img?'img':text?'p':'section';
 const content=React.createElement(tag,{'data-awb-element':'/target',...(img?{src:"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='240'%3E%3Crect width='400' height='240' fill='purple'/%3E%3C/svg%3E"}:{}),style:{display:'block',boxSizing:'border-box',margin:0,width:400,height:240,background:'purple',...elementColor(props,'/target'),...(img?{width:((props.imageSizes?.['/target']?.width??50)*8),height:props.imageSizes?.['/target']?.height??240}:{})}},img?undefined:'Resize target');
 return <div style={{position:'relative',width:800,margin:60}}><div ref={setNode}>{free?<FreeLayout elements={props.freeElements} render={()=>content}><div style={{height:500}}/></FreeLayout>:applyElementOffsets(content,props)}</div><ImageResizeHandle node={node} path={path} revision={props} onResize={commit} onFontResize={commit}/></div>
}
createRoot(document.getElementById('root')).render(<App/>);
`,resolveDir:process.cwd(),loader:'tsx'},tsconfig:'apps/web/tsconfig.json',bundle:true,write:false,format:'iife',jsx:'automatic'})
const browser=await chromium.launch({headless:true,args:['--no-sandbox'],env:{...process.env,LD_LIBRARY_PATH:'/tmp/webtummy-browser-libs/root/usr/lib/x86_64-linux-gnu'}})
try {
 const page=await browser.newPage({viewport:{width:1200,height:900}})
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message))
 await page.route('http://resize.test/**',r=>r.fulfill({contentType:'text/html',body:'<div id="root"></div><style>button{position:absolute;width:18px;height:18px;z-index:30}</style>'}))
 for(const mode of ['block','text','free','image']) {
  for(const edge of ['top middle','bottom middle']) {
   await page.goto('http://resize.test/?mode='+mode);await page.addScriptTag({content:bundle.outputFiles[0]!.text})
   const kind=mode==='free'?'block':mode
   const handle=page.getByRole('button',{name:'Resize '+kind+' from '+edge,exact:true});await handle.waitFor()
   const target=page.locator(mode==='free'?'[data-awb-free-item]':'[data-awb-element="/target"]')
   const before=(await target.boundingBox())!,grip=(await handle.boundingBox())!,delta=edge.startsWith('top')?60:-60
   await page.mouse.move(grip.x+9,grip.y+9);await page.mouse.down();await page.mouse.move(grip.x+9,grip.y+9+delta,{steps:10})
   const live=(await target.boundingBox())!
   assert.ok(Math.abs(live.height-(before.height-60))<2,mode+' shrinks live')
   const anchor=(b:any)=>edge.startsWith('top')?b.y+b.height:b.y
   assert.ok(Math.abs(anchor(live)-anchor(before))<2,mode+' opposite edge stays anchored live')
   await page.mouse.up();await page.waitForTimeout(80)
   const after=(await target.boundingBox())!
   assert.ok(Math.abs(after.y-live.y)<2 && Math.abs(after.height-live.height)<2,mode+' position and size persist')
   assert.equal(await page.evaluate(()=>window.commits),1)
   const cancelGrip=(await handle.boundingBox())!
   await page.mouse.move(cancelGrip.x+9,cancelGrip.y+9);await page.mouse.down();await page.mouse.move(cancelGrip.x+9,cancelGrip.y+39);await page.keyboard.press('Escape');await page.mouse.up()
   const cancelled=(await target.boundingBox())!
   assert.ok(Math.abs(cancelled.y-after.y)<2 && Math.abs(cancelled.height-after.height)<2,mode+' Escape restores position and size')
   assert.equal(await page.evaluate(()=>window.commits),1)
  }
 }
 assert.deepEqual(errors,[])
 console.log('PASS: block, text, free-layout and image top/bottom edges stay anchored during drag and after save; Escape restores geometry.')
} finally {await browser.close()}
