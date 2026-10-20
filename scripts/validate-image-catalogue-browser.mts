import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import { build } from 'esbuild'
const { chromium } = await import('/tmp/webtummy-ui-check/node_modules/playwright/index.mjs')
const compiled = await build({ stdin: { resolveDir: process.cwd(), loader: 'tsx', contents: `
import React,{useState} from 'react';import {createRoot} from 'react-dom/client';import {flushSync} from 'react-dom';
import {listComponents,defaultTokens} from './packages/component-registry/src';
import {imageVisibleBounds} from './apps/web/src/lib/image-visible-bounds';
window.visibleBounds=imageVisibleBounds;
import {ImageResizeHandle} from './apps/web/src/app/projects/[id]/editor/image-resize-handle';
const image='data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="600" height="120"%3E%3Crect width="600" height="120" fill="purple"/%3E%3C/svg%3E';
const seed={id:'audit',kind:'image',label:'Example',title:'Example',description:'Example',body:'Example',question:'Example?',answer:'Example',href:'/example',imageUrl:image,imageAlt:'Example',url:image,alt:'Example',issuer:'Example',year:'2026',category:'Example',links:[],children:[]};
function fill(value,key=''){if(Array.isArray(value))return (value.length?value:['items','images'].includes(key)?[seed]:[]).map(v=>fill(v,key));if(value&&typeof value==='object'){const result={...value,imageUrl:image,...(key==='images'?{url:image}:{})};for(const k of Object.keys(result)){result[k]=/imageUrl$/i.test(k)||(key==='images'&&k==='url')?image:fill(result[k],k)};return result};return value}
const cases=listComponents().map(d=>{const values=fill(d.fixture);for(const f of d.editorFields){if(f.type==='image'&&!f.path.includes('/',1))values[f.path.slice(1)]=image};const parsed=d.propsSchema.safeParse(values);if(!parsed.success)throw Error(d.componentId+JSON.stringify(parsed.error.issues));return {id:d.componentId,values:parsed.data}});
window.auditCases=cases.map(c=>c.id);
function App(){const [state,setState]=useState({index:0,path:undefined,contain:false}),[node,setNode]=useState(null);window.auditSelect=(index,path,contain=false)=>flushSync(()=>setState({index,path,contain}));const c=cases[state.index],d=listComponents().find(d=>d.componentId===c.id);const values=state.contain&&state.path?{...c.values,imageSizes:{[state.path]:{width:55,height:180,fit:'contain',position:'top'}}}:c.values;
return <div data-audit-state={state.index+':'+(state.path||'')+':'+state.contain} style={{position:'relative',width:'100%'}}><div ref={setNode}>{React.createElement(d.render,{props:values,context:{tokens:defaultTokens,baseUrl:'',editing:true,pagePath:'/about'}})}</div><ImageResizeHandle key={c.id+state.path} revision={values} node={node} path={state.path} onResize={()=>{}} onFontResize={()=>{}}/></div>}
createRoot(document.getElementById('root')).render(<App/>);
` }, tsconfig:'apps/web/tsconfig.json', jsx:'automatic', logLevel:'error', bundle:true,write:false,format:'iife',define:{'process.env.NEXT_PUBLIC_ENABLE_LAYOUT_TEMPLATES':'"true"'} })
const browser=await chromium.launch({headless:true,args:['--no-sandbox'],env:{...process.env,LD_LIBRARY_PATH:'/tmp/webtummy-browser-libs/root/usr/lib/x86_64-linux-gnu'}})
const failures:any[]=[], totals={components:0,images:0,backgrounds:0,decorations:0,checks:0},errors:string[]=[]
try {
 const page=await browser.newPage({viewport:{width:1280,height:900}})
 page.on('pageerror',e=>errors.push(e.message))
 await page.route('http://audit.test/**',async route=>{const url=new URL(route.request().url());if(url.pathname.endsWith('.css')){try{return await route.fulfill({contentType:'text/css',body:await readFile('apps/web/public'+url.pathname,'utf8')})}catch{return route.fulfill({body:''})}};return route.fulfill({contentType:'text/html',body:'<script>window.__name=fn=>fn</script><div id="root"></div><style>.absolute{position:absolute}.fixed{position:fixed}.pointer-events-none{pointer-events:none}body{margin:0}button[aria-label^="Resize"]{position:absolute;width:18px;height:18px;z-index:30}</style>'})})
 await page.goto('http://audit.test/');await page.addScriptTag({content:compiled.outputFiles[0]!.text});await page.waitForFunction(()=>window.auditCases)
 const cases:string[]=await page.evaluate(()=>window.auditCases)
 const filter=process.env.IMAGE_AUDIT_COMPONENTS?.split(',')
 for(const viewport of [1280,390]){
  await page.setViewportSize({width:viewport,height:900})
  for(let index=0;index<cases.length;index++){
   if(filter&&!filter.includes(cases[index]!))continue
   await page.evaluate(async index=>{window.auditSelect(index,undefined);await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))},index)
   await page.waitForFunction(state=>document.querySelector('[data-audit-state]')?.getAttribute('data-audit-state')===state,index+'::false')
   const images=await page.locator('#root img').evaluateAll(async images=>{await Promise.all(images.map(img=>{img.loading='eager';return img.decode().catch(()=>{})}));return images.map(img=>{const box=img.getBoundingClientRect(),s=getComputedStyle(img);return {path:img.dataset.awbElement,decoration:!img.dataset.awbElement&&img.getAttribute('src')?.startsWith('/template-library/'),background:!!img.closest('.awb-native-background')||img.getAttribute('aria-hidden')==='true',absolute:s.position==='absolute',visible:box.width>0&&box.height>0&&s.display!=='none'&&s.visibility!=='hidden'}}).filter(img=>img.visible)})
   if(viewport===1280){totals.components++;totals.images+=images.length;totals.backgrounds+=images.filter(i=>i.background).length;totals.decorations+=images.filter(i=>i.decoration).length}
   for(const img of images.filter((img,i,all)=>!img.path||all.findIndex(other=>other.path===img.path)===i)){
    if(img.background||img.decoration)continue
    if(!img.path){failures.push({id:cases[index],viewport,reason:'Image has no editable path'});continue}
    for(const contain of [false,true]){
     await page.evaluate(async args=>{window.auditSelect(args.index,args.path,args.contain);await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))},{index,path:img.path,contain})
     await page.waitForFunction(state=>document.querySelector('[data-audit-state]')?.getAttribute('data-audit-state')===state,index+':'+img.path+':'+contain)
     const inspect = (path: string) => {const image=Array.from(document.querySelectorAll('#root img')).filter(img=>img.dataset.awbElement===path).sort((a,b)=>b.getBoundingClientRect().width-a.getBoundingClientRect().width)[0];if(!image)return {missing:true,paths:Array.from(document.querySelectorAll('#root img')).map(i=>i.dataset.awbElement)};const b=image.getBoundingClientRect(),s=getComputedStyle(image),sx=b.width/image.offsetWidth,sy=b.height/image.offsetHeight,padX=(parseFloat(s.paddingLeft)+parseFloat(s.borderLeftWidth))*sx,padY=(parseFloat(s.paddingTop)+parseFloat(s.borderTopWidth))*sy;let width=b.width-padX-(parseFloat(s.paddingRight)+parseFloat(s.borderRightWidth))*sx,height=b.height-padY-(parseFloat(s.paddingBottom)+parseFloat(s.borderBottomWidth))*sy,x=b.x+padX,y=b.y+padY;if(s.objectFit==='contain'){const factor=Math.min(width/(image.naturalWidth*sx),height/(image.naturalHeight*sy));const w=image.naturalWidth*sx*factor,h=image.naturalHeight*sy*factor;const pos=s.objectPosition.split(' ');const offset=(v,space)=>v.endsWith('%')?parseFloat(v)/100*space:parseFloat(v)||0;x+=offset(pos[0],width-w);y+=offset(pos[1],height-h);width=w;height=h};if(s.objectFit!=='contain'){x=b.x;y=b.y;width=b.width;height=b.height};const buttons=Array.from(document.querySelectorAll('button'));const tl=buttons.find(b=>b.getAttribute('aria-label')==='Resize image from top left')?.getBoundingClientRect(),br=buttons.find(b=>b.getAttribute('aria-label')==='Resize image from bottom right')?.getBoundingClientRect();return {x,y,width,height,tl:tl?{x:tl.x+9,y:tl.y+9}:null,br:br?{x:br.x+9,y:br.y+9}:null,duplicates:Array.from(document.querySelectorAll('#root img')).filter(i=>i.dataset.awbElement===path).map(i=>({box:i.getBoundingClientRect().toJSON(),visibility:getComputedStyle(i).visibility})),fit:s.objectFit,raw:b.toJSON(),helper:window.visibleBounds(image).toJSON(),offset:{width:image.offsetWidth,height:image.offsetHeight,position:s.objectPosition,padding:s.padding,border:s.border,transform:s.transform},style:image.getAttribute('style'),debug:buttons.filter(b=>b.getAttribute('aria-label')==='Resize image from top left').map(b=>({style:b.getAttribute('style'),computed:{transform:getComputedStyle(b).transform,margin:getComputedStyle(b).margin,translate:getComputedStyle(b).translate,position:getComputedStyle(b).position},parent:b.offsetParent?.getBoundingClientRect().toJSON(),host:document.querySelector('[data-audit-state]')?.getBoundingClientRect().toJSON()}))}}
     const differs = (result: any) => !result.tl || !result.br || Math.abs(result.tl.x-result.x)>2 || Math.abs(result.tl.y-result.y)>2 || Math.abs(result.br.x-result.x-result.width)>2 || Math.abs(result.br.y-result.y-result.height)>2
     let result=await page.evaluate(inspect,img.path)
     // React stylesheet loading and font metrics may settle after the first frame.
     if(differs(result)){await page.waitForTimeout(150);result=await page.evaluate(inspect,img.path)}
     totals.checks++
     if(differs(result))failures.push({id:cases[index],path:img.path,viewport,contain,reason:'Handles differ from visible image',result})
     if(contain&&(result.fit!=='contain'||!result.style?.includes('180px')))failures.push({id:cases[index],path:img.path,viewport,reason:'Sizing settings not applied',result})
    }
   }
   if(index%50===0)console.log('Audited',viewport,index,'/',cases.length)
  }
 }
 await writeFile('/tmp/webtummy-image-catalogue-audit.json',JSON.stringify({totals,failures,errors},null,2))
 console.log(JSON.stringify({totals,failures:failures.length,examples:failures.slice(0,3),errors:errors.slice(0,3)},null,2))
 assert.equal(failures.length,0,'Image catalogue audit failures; see /tmp/webtummy-image-catalogue-audit.json');assert.deepEqual(errors,[])
}finally{await browser.close()}
