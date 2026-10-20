import assert from 'node:assert/strict'
import { build } from 'esbuild'
const { chromium } = await import('/tmp/webtummy-ui-check/node_modules/playwright/index.mjs')
const bundle=await build({stdin:{resolveDir:process.cwd(),loader:'tsx',contents:`
import React,{useState} from 'react';import {createRoot} from 'react-dom/client';
import {Inspector} from './apps/web/src/app/projects/[id]/editor/inspector';
import {getComponent} from './packages/component-registry/src';import {setAtPointer} from './apps/web/src/lib/json-pointer';
const image='data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="600" height="120"%3E%3Crect width="600" height="120" fill="purple"/%3E%3C/svg%3E';
const id=new URLSearchParams(location.search).get('id'),definition=getComponent(id);
const item={id:'test',kind:'image',label:'Example',title:'Example',description:'Example',href:'/example',imageUrl:image,imageAlt:'Example',url:image,alt:'Example'};
function App(){const [values,setValues]=useState(()=>definition.propsSchema.parse({...definition.fixture,imageUrl:image,logoImageUrl:image,items:[item],images:[item]}));window.values=values;return <Inspector projectId="audit" componentName={definition.name} currentComponentId={id} variants={[]} fields={definition.editorFields} props={values} onSwitchVariant={()=>{}} onChange={(path,value)=>setValues(current=>setAtPointer(current,path,value))}/>}
createRoot(document.getElementById('root')).render(<App/>);
`},tsconfig:'apps/web/tsconfig.json',bundle:true,write:false,format:'iife',jsx:'automatic',plugins:[{name:'inspector-test-boundaries',setup(build){build.onResolve({filter:/^(next\/navigation|.*ai-image-update|.*upload-button)$/},args=>({path:args.path,namespace:'stub'}));build.onLoad({filter:/.*/,namespace:'stub'},args=>({contents:args.path==='next/navigation'?'export const useRouter=()=>({refresh(){}});':args.path.endsWith('ai-image-update')?'export const AiImageUpdate=()=>null;':'export const UploadButton=()=>null;',loader:'js'}))}}]})
const browser=await chromium.launch({headless:true,args:['--no-sandbox'],env:{...process.env,LD_LIBRARY_PATH:'/tmp/webtummy-browser-libs/root/usr/lib/x86_64-linux-gnu'}})
try{
 const page=await browser.newPage();const errors:string[]=[];page.on('pageerror',e=>{errors.push(e.message);console.log('BROWSER ERROR',e.message)})
 await page.route('http://inspector.test/**',route=>route.fulfill({contentType:'text/html',body:'<div id="root"></div>'}))
 const cases=[['HeaderTransparent','/logoImageUrl'],['FooterEditorial','/logoImageUrl'],['HeroEditorial','/imageUrl'],['ServicesImageRail','/items/0/imageUrl'],['GalleryAsymmetric','/images/0/url'],['PortfolioShowcase','/items/0/imageUrl'],['CredentialsShowcase','/items/0/imageUrl'],['ManualSection','/items/0/imageUrl']]
 for(const [id,path] of cases){
  console.log('Checking inspector',id)
  await page.goto('http://inspector.test/?id='+id);await page.addScriptTag({content:bundle.outputFiles[0]!.text})
  const width=page.getByRole('slider',{name:'Image width',exact:true}).first();await width.waitFor();await width.focus();await width.press('Home');await width.press('ArrowRight')
  const sizes=await page.evaluate(()=>window.values.imageSizes)
  assert.equal(sizes[path!].width,11,id+' width slider updates the exact image')
  const height=page.getByRole('slider',{name:'Image height',exact:true}).first();await height.focus();await height.press('Home');await height.press('ArrowRight')
  assert.equal(await page.evaluate(path=>window.values.imageSizes[path].height,path),41,id+' height slider updates the exact image')
 }
 assert.deepEqual(errors,[]);console.log('PASS: header/footer logos, hero, service, gallery, portfolio, credential and manual image sliders update their exact image paths.')
}finally{await browser.close()}
