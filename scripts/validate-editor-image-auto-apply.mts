import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { unlink } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import { JSDOM } from 'jsdom'
const dom=new JSDOM('<div id="root" data-awb-editor-root></div>',{url:'http://localhost'})
for(const key of ['window','document','Element','HTMLElement','Node','Event','CustomEvent'])Object.defineProperty(globalThis,key,{configurable:true,value:(dom.window as any)[key]})
Object.defineProperty(document,'hidden',{configurable:true,value:false})
;(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true
const target={pageId:'home',sectionId:'hero',pointer:'/imageUrl',originalUrl:'/old.png'}
let ready=false,completed=0
;(globalThis as any).fetch=async()=>({ok:true,json:async()=>({jobs:[{id:'job-1',title:'Image update: local advice',kind:'COVER',status:ready?'READY':'RUNNING',projectId:'fixture'}]})})
;(globalThis as any).__imageRead=async()=>({id:'job-1',kind:'COVER',editorTarget:target,result:{url:'/new.png',alt:'New advice image'}})
const React=await import('react');const{createRoot}=await import('react-dom/client');const root=createRoot(document.getElementById('root')!)
const outfile=`${process.cwd()}/scripts/.image-auto-apply.mjs`
try{
 await build({entryPoints:['apps/web/src/components/content-job-notifications.tsx'],outfile,bundle:true,platform:'node',format:'esm',packages:'external',jsx:'automatic',plugins:[{name:'mocks',setup(b){b.onResolve({filter:/^@\/app\/actions\/content-jobs$/},()=>({path:'actions',namespace:'mock'}));b.onResolve({filter:/^next\/link$/},()=>({path:'link',namespace:'mock'}));b.onLoad({filter:/.*/,namespace:'mock'},a=>({loader:'js',contents:a.path==='link'?"export default function Link(){return null}":'export const readContentResult=(...args)=>globalThis.__imageRead(...args);export const dismissContentJob=async()=>{};export const retryContentJob=async()=>{}'}))}}]})
 const{ContentJobNotifications}=await import(pathToFileURL(outfile).href)
 await React.act(async()=>root.render(React.createElement(ContentJobNotifications,{projectId:'fixture',onApply:(detail:any)=>{assert.deepEqual(detail.editorTarget,target);completed++}})))
 assert.ok(document.querySelector('[aria-modal=true][aria-busy=true]'),'Editor-wide loader persists independently of the image panel')
 assert.equal((document.getElementById('root') as HTMLElement).inert,true)
 // No image panel is mounted. Completion must still target its original position.
 ready=true
 await React.act(async()=>{window.dispatchEvent(new Event('awb-content-queued'));await new Promise(r=>setTimeout(r,0))})
 for(let i=0;i<3;i++)await React.act(async()=>{await new Promise(r=>setTimeout(r,0))})
 assert.equal(completed,1)
 assert.equal(document.querySelector('[aria-modal=true][aria-busy=true]'),null)
 assert.equal((document.getElementById('root') as HTMLElement).inert,false)
 assert.ok(document.body.textContent?.includes('Image replaced in your editor'))
 await React.act(async()=>{window.dispatchEvent(new Event('awb-content-queued'));await new Promise(r=>setTimeout(r,0))})
 assert.equal(completed,1,'Polling does not repeatedly replace the image')
 console.log('PASS: editor-wide loader blocks actions while running; completed job automatically applies even after panel closure; persisted target is forwarded; loader clears and repeated polls do not reapply.')
}finally{await React.act(async()=>root.unmount());await unlink(outfile).catch(()=>{});dom.window.close()}
