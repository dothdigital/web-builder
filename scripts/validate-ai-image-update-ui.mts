import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { unlink } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import { JSDOM } from 'jsdom'
import { blogCoverPrompt, blogCoverRequestSchema } from '../packages/pipeline/src/content-creation'
const dom = new JSDOM('<div id="root" data-awb-editor-root></div>', { url: 'http://localhost' })
for (const key of ['window','document','Element','HTMLElement','Node','Event','MouseEvent']) Object.defineProperty(globalThis,key,{configurable:true,value:(dom.window as any)[key]})
Object.defineProperty(dom.window.document,'hidden',{configurable:true,value:false})
;(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true
const requests:any[]=[];const changes:any[]=[]
let resolveQueue: (value: unknown) => void = () => {}
;(globalThis as any).__imageActions={createBlogCover:async(...args:any[])=>{requests.push(args);return new Promise(resolve => { resolveQueue = resolve })},readContentResult:async()=>({result:{url:'https://images.invalid/new.png',alt:'A local community consultation'}})}
;(globalThis as any).fetch=async()=>({ok:true,json:async()=>({jobs:[{id:'test-image-job',status:'READY'}]})})
const React=await import('react');const {createRoot}=await import('react-dom/client')
const root=createRoot(document.getElementById('root')!)
const outfile=`${process.cwd()}/scripts/.ai-image-update-test.mjs`
try{
 await build({entryPoints:['apps/web/src/app/projects/[id]/editor/inspector.tsx'],outfile,bundle:true,platform:'node',format:'esm',packages:'external',jsx:'automatic',plugins:[{name:'mock-actions',setup(b){b.onResolve({filter:/^next\/navigation$/},()=>({path:'nav',namespace:'mock'}));b.onResolve({filter:/^@\/app\/actions\/content-jobs$/},()=>({path:'actions',namespace:'mock'}));b.onLoad({filter:/.*/,namespace:'mock'},args=>({loader:'js',contents:args.path==='nav'?'const router={refresh(){}};export const useRouter=()=>router':'export const createBlogCover=(...args)=>globalThis.__imageActions.createBlogCover(...args);export const readContentResult=(...args)=>globalThis.__imageActions.readContentResult(...args)'}))}}]})
 const {ImageField}=await import(pathToFileURL(outfile).href)
 await React.act(async()=>root.render(React.createElement(ImageField,{projectId:'fixture',value:'https://images.invalid/original.png',imageUrls:{'https://images.invalid/original.png':'/original-preview'},aiContext:'Service: local insurance guidance',onChange:(url:string)=>changes.push({url}),onGenerated:(url:string,alt:string)=>changes.push({url,alt})})))
 const button=(text:string)=>[...document.querySelectorAll('button')].find(b=>b.textContent===text)!
 const click=async(node:HTMLElement)=>{assert.ok(node);await React.act(async()=>node.click())}
 assert.ok(document.querySelector('input[type=file]'),'Upload from computer remains available')
 assert.ok(button('Choose from image library (1)'))
 await click(button('Update with AI'))
 assert.equal(document.querySelectorAll('input[type=checkbox]').length,5)
 assert.ok(button('Generate image with AI').disabled)
 const instruction=document.querySelector('textarea')!
 await React.act(async()=>{Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype,'value')!.set!.call(instruction,'Show a natural consultation in a Canadian community.');instruction.dispatchEvent(new Event('input',{bubbles:true}))})
 await click(document.querySelectorAll('input[type=checkbox]')[0] as HTMLInputElement)
 await click(document.querySelectorAll('input[type=checkbox]')[1] as HTMLInputElement)
 await click(button('Generate image with AI'))
 assert.ok(document.querySelector('[role=dialog][aria-busy=true]'), 'Full-screen generating overlay appears')
 assert.equal((document.getElementById('root') as HTMLElement).inert,true,'Other editor controls are inert')
 const leave = new Event('beforeunload',{cancelable:true}); window.dispatchEvent(leave); assert.ok(leave.defaultPrevented,'Leaving while generating prompts the browser')
 await React.act(async()=>resolveQueue({jobId:'test-image-job'}))
 for(let i=0;i<3;i++)await React.act(async()=>{await new Promise(r=>setTimeout(r,0))})
 assert.equal(requests.length,1)
 const request=blogCoverRequestSchema.parse(requests[0][1])
 assert.equal(request.purpose,'website');assert.deepEqual(request.imageDirection?.styles,['people','local'])
 const prompt=blogCoverPrompt(request)
 for(const text of ['Service: local insurance guidance','Canadian community','human interactions','community context'])assert.ok(prompt.includes(text))
 assert.ok(!button('Use this image'), 'No manual library/selection step is required')
 assert.equal((document.getElementById('root') as HTMLElement).inert,false,'Editor becomes usable after completion')
 assert.deepEqual(changes,[{url:'https://images.invalid/new.png',alt:'A local community consultation'}])
 assert.ok(document.body.textContent?.includes('Save the website to keep this change.'))
 assert.ok(!blogCoverRequestSchema.safeParse({...request,direction:''}).success)
 console.log('PASS: Replace image retains upload/library; AI styles and instructions submitted; selected URL and alt replace the image automatically after background completion; server validates instructions.')
}finally{await React.act(async()=>root.unmount());await unlink(outfile).catch(()=>{});await unlink(outfile.replace('.mjs','.css')).catch(()=>{});dom.window.close()}
