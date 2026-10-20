import assert from 'node:assert/strict'
import { build } from 'esbuild'
const { chromium } = await import('/tmp/webtummy-ui-check/node_modules/playwright/index.mjs')
const bundle = await build({ stdin: { contents: `
import React, {useState} from 'react';
import {createRoot} from 'react-dom/client';
import {ImageResizeHandle} from './apps/web/src/app/projects/[id]/editor/image-resize-handle';
import {FreeLayout} from './packages/component-registry/src/free-elements';
import {getComponent,defaultTokens} from './packages/component-registry/src';
function App(){
 const [node,setNode]=useState(null),[size,setSize]=useState({width:50,height:240});
 const mode=new URLSearchParams(location.search).get('mode')||'free';
 const hero=mode==='hero-booking'||mode==='hero-inner';
 const definition=hero?getComponent(mode==='hero-booking'?'HeroSplitBooking':'HeroEditorial'):null;
 const heroImage="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1200' height='240'%3E%3Crect width='1200' height='240' fill='purple'/%3E%3C/svg%3E";
 const heroProps=definition?.propsSchema.parse({...definition.fixture,imageUrl:heroImage,...(size.width!==50?{imageSizes:{'/imageUrl':size}}:{})});
 const free=mode==='free'||mode==='frame'||mode==='scaled';
 const media=<img data-awb-element="/imageUrl" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='240'%3E%3Crect width='400' height='240' fill='purple'/%3E%3C/svg%3E" style={{display:'block',width:'100%',height:240,objectFit:'cover'}}/>;
 const content=mode==='frame'?<div data-awb-element="/layout/0" data-awb-image-container="/imageUrl" style={{width:400,height:400}}>{media}</div>:media;
 return <div style={{position:'relative',width:800,margin:'60px'}}><div ref={setNode}>
 {hero?React.createElement(definition.render,{props:heroProps,context:{tokens:defaultTokens,baseUrl:'',editing:true,pagePath:mode==='hero-inner'?'/about':'/'}}):free?<FreeLayout elements={[{id:'test',componentId:'Test',source:'/imageUrl',content:{},x:0,y:0,contentScale:mode==='scaled'?1.5:1,...size}]} render={()=>content}><div style={{height:500}}/></FreeLayout>:<div style={{width:400}}>{content}</div>}
 </div><ImageResizeHandle sectionWideImages node={node} path={free?'/freeElements/0':'/imageUrl'} revision={size} onResize={value=>{window.commits=(window.commits||0)+1;window.result=value;setSize(value)}} onFontResize={()=>{throw Error('Image classified as block')}}/></div>
}
createRoot(document.getElementById('root')).render(<App/>);
`, resolveDir: process.cwd(), loader: 'tsx' }, tsconfig: 'apps/web/tsconfig.json', bundle: true, write: false, format: 'iife', jsx: 'automatic' })
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'], env: { ...process.env, LD_LIBRARY_PATH: '/tmp/webtummy-browser-libs/root/usr/lib/x86_64-linux-gnu' } })
try {
 const page = await browser.newPage({viewport:{width:1200,height:900}})
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message))
 await page.route('http://resize.test/**',route=>route.fulfill({contentType:'text/html',body:'<div id="root"></div><style>button{position:absolute;width:18px;height:18px;z-index:30}</style>'}))
 for(const mode of ['free','frame','scaled','normal','hero-booking','hero-inner']) {
  await page.goto('http://resize.test/?mode='+mode);await page.addScriptTag({content:bundle.outputFiles[0]!.text})
  const image=page.locator('img');const handle=page.getByRole('button',{name:'Resize image from bottom right',exact:true})
  await handle.waitFor();await image.evaluate(img=>img.decode());await page.waitForTimeout(70)
  const painted=async()=>image.evaluate((img:HTMLImageElement)=>{const b=img.getBoundingClientRect(),s=getComputedStyle(img);if(s.objectFit!=='contain')return {x:b.x,y:b.y,width:b.width,height:b.height};const factor=Math.min(b.width/img.naturalWidth,b.height/img.naturalHeight),width=img.naturalWidth*factor,height=img.naturalHeight*factor;return {x:b.x+(b.width-width)/2,y:b.y+(b.height-height)/2,width,height}})
  const before=await painted(),square=(await handle.boundingBox())!
  if(mode.startsWith('hero')){const outer=(await image.boundingBox())!;assert.ok(outer.height>before.height+100,'Real hero reproduces tall empty image box')}
  assert.ok(Math.abs(square.x+9-before.x-before.width)<2,mode+' handles follow actual image width')
  assert.ok(Math.abs(square.y+9-before.y-before.height)<2,mode+' handles follow actual image height')
  await page.mouse.move(square.x+9,square.y+9);await page.mouse.down();await page.mouse.move(square.x+89,square.y+57,{steps:12});await page.waitForTimeout(70)
  const live=await painted()
  assert.ok(live.width>before.width+Math.min(60,(800-before.width)*.75),mode+' image grows before mouseup')
  assert.ok(live.height>before.height+Math.min(10,(800-before.width)*before.height/before.width*.75),mode+' image height grows before mouseup')
  assert.equal(await page.evaluate(()=>window.commits||0),0,'No persisted changes during drag')
  const liveSquare=(await handle.boundingBox())!
  assert.ok(Math.abs(liveSquare.x+9-live.x-live.width)<2,mode+' handles stay attached during drag')
  await page.mouse.up();await page.waitForTimeout(70)
  assert.equal(await page.evaluate(()=>window.commits),1,'One commit on release')
  if(mode==='free'||mode==='frame'||mode==='scaled'){
   const after=(await image.boundingBox())!;assert.ok(Math.abs(after.width-live.width)<2,mode+' width stays after release');assert.ok(Math.abs(after.height-live.height)<2,mode+' height stays after release')
  }
  const anchoredBefore=await painted()
  const topLeft=page.getByRole('button',{name:'Resize image from top left',exact:true}),anchorSquare=(await topLeft.boundingBox())!
  await page.mouse.move(anchorSquare.x+9,anchorSquare.y+9);await page.mouse.down();await page.mouse.move(anchorSquare.x+49,anchorSquare.y+33,{steps:8});await page.waitForTimeout(50)
  const anchoredLive=await painted()
  assert.ok(Math.abs(anchoredBefore.x+anchoredBefore.width-anchoredLive.x-anchoredLive.width)<2,mode+' left handle anchors right edge')
  assert.ok(Math.abs(anchoredBefore.y+anchoredBefore.height-anchoredLive.y-anchoredLive.height)<2,mode+' top handle anchors bottom edge')
  assert.ok(anchoredLive.width<anchoredBefore.width-30,mode+' top-left drag shrinks image live')
  await page.keyboard.press('Escape');await page.mouse.up();await page.waitForTimeout(50)
  const cancelBefore=(await image.boundingBox())!,cancelSquare=(await handle.boundingBox())!
  await page.mouse.move(cancelSquare.x+9,cancelSquare.y+9);await page.mouse.down();await page.mouse.move(cancelSquare.x-31,cancelSquare.y-15,{steps:5});await page.keyboard.press('Escape');await page.mouse.up();await page.waitForTimeout(50)
  const cancelAfter=(await image.boundingBox())!;assert.ok(Math.abs(cancelBefore.width-cancelAfter.width)<2,mode+' Escape restores geometry');assert.equal(await page.evaluate(()=>window.commits),1,'Cancel creates no commit')
 }
 assert.deepEqual(errors,[])
 console.log('PASS: image handles follow image edges; normal, moved, framed and real hero images resize live; release commits once; moved sizes persist; Escape restores sizing.')
} finally {await browser.close()}
