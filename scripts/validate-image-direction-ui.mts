import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { unlink } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import { JSDOM } from 'jsdom'
import { imageDirectionPrompt } from '@awb/shared/image-direction'
import { intakeMediaSchema } from '@awb/shared/intake-media'
import { rerunRequestSchema } from '@awb/shared/rerun-request'
const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost' })
for (const key of ['window','document','Element','HTMLElement','HTMLDialogElement','Node','Event','MouseEvent']) Object.defineProperty(globalThis,key,{configurable:true,value:(dom.window as any)[key]})
;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true
;(dom.window.HTMLDialogElement.prototype as any).showModal = function(){this.open=true}
;(dom.window.HTMLDialogElement.prototype as any).close = function(){this.open=false}
const calls: Record<string, any[]> = {}
;(globalThis as any).__imageTestAction = async(name:string,args:any[])=>{(calls[name]??=[]).push(args);return name==='createProjectFromBrief'?{projectId:'fixture'}:name==='startGeneration'?{correlationId:'test'}:undefined}
const React = await import('react')
const {createRoot} = await import('react-dom/client')
const root = createRoot(document.getElementById('root')!)
const files:string[]=[]
async function component(entry:string){
 const outfile=`${process.cwd()}/scripts/.image-direction-${files.length}.mjs`;files.push(outfile)
 await build({entryPoints:[entry],outfile,bundle:true,platform:'node',format:'esm',packages:'external',jsx:'automatic',define:{'process.env.NEXT_PUBLIC_ENABLE_LAYOUT_TEMPLATES':'"false"'},plugins:[{name:'mocks',setup(b){
 b.onResolve({filter:/^next\/navigation$/},()=>({path:'navigation',namespace:'mock'}))
 b.onResolve({filter:/^@\/app\/actions\/projects$/},()=>({path:'actions',namespace:'mock'}))
 b.onResolve({filter:/intake-voice$/},()=>({path:'voice',namespace:'mock'}))
 b.onLoad({filter:/.*/,namespace:'mock'},args=>({loader:'js',contents:args.path==='navigation'?'export const useRouter=()=>({push(){},refresh(){}})':args.path==='voice'?'export const IntakeVoice=()=>null':`const call=(n)=>(...args)=>globalThis.__imageTestAction(n,args); ${['createProjectFromBrief','saveBrandColors','saveIntakeMedia','saveBusinessPresence','saveTestimonials','startGeneration'].map(n=>`export const ${n}=call('${n}');`).join('')}`}))
 }}]})
 return import(pathToFileURL(outfile).href)
}
const click=async(element:HTMLElement)=>{assert.ok(element);await React.act(async()=>element.click())}
const button=(label:string)=>[...document.querySelectorAll('button')].find(b=>b.textContent===label)!
const labelInput=(label:string)=>[...document.querySelectorAll('label')].find(l=>l.textContent?.trim()===label)?.querySelector('input') as HTMLInputElement
async function fill(input:HTMLInputElement|HTMLTextAreaElement,value:string){await React.act(async()=>{const proto=input.tagName==='TEXTAREA'?window.HTMLTextAreaElement.prototype:window.HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value')!.set!.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}))})}
try {
 console.log('Checking intake form')
 const {OnboardingWizard}=await component('apps/web/src/app/onboarding/onboarding-wizard.tsx')
 await React.act(async()=>root.render(React.createElement(OnboardingWizard)))
 const inputs=[...document.querySelectorAll('input')]
 // Business name and description are the only mandatory fields for moving forward.
 const business=[...document.querySelectorAll('label')].find(l=>l.textContent?.includes('Business name'))!.querySelector('input')!
 const description=[...document.querySelectorAll('label')].find(l=>l.textContent?.includes('What does the business do?'))!.querySelector('textarea')!
 await fill(business,'Image preference fixture');await fill(description,'A sample local business providing practical services.')
 await click(button('Continue'))
 await click(button('Continue — let AI choose'))
 assert.ok(document.querySelector('legend')?.textContent?.includes('Generated image style'))
 const labels=['People and human moments','Local places and community','Industry-specific imagery','Illustrations and abstract visuals','Custom direction']
 for(const label of labels)assert.ok(labelInput(label),label)
 await click(labelInput(labels[0]!));await click(labelInput(labels[1]!))
 await click(document.querySelector('input[name=imageMode]') as HTMLInputElement)
 assert.equal(Boolean(labelInput(labels[0]!)),false,'Upload-only hides generated styles')
 await click(document.querySelectorAll('input[name=imageMode]')[1] as HTMLInputElement)
 assert.ok(labelInput(labels[0]!).checked && labelInput(labels[1]!).checked,'Switching modes preserves choices')
 await click(button('Continue'))
 const saved=intakeMediaSchema.parse(calls.saveIntakeMedia![0]![1]);assert.deepEqual(saved.imageDirection?.styles,['people','local'])
 const prompt=imageDirectionPrompt(saved.imageDirection!,'Toronto');assert.match(prompt,/human interactions/);assert.match(prompt,/Local context: Toronto/)
 console.log('Intake checks passed; checking rerun form')
 const {RerunAi}=await component('apps/web/src/app/dashboard/rerun-ai.tsx')
 await React.act(async()=>root.render(React.createElement(RerunAi,{projectId:'fixture',built:true,generating:false,initialImageDirection:saved.imageDirection})))
 await click(button('Rerun with AI'))
 console.log('Rerun dialog opened')
 assert.equal(Boolean(labelInput(labels[0]!)),false,'Content only has no image settings')
 await click(document.querySelector('input[value=IMAGES]') as HTMLInputElement)
 assert.ok(labelInput(labels[0]!).checked,'Rerun restores saved choices')
 await click(labelInput(labels[3]!))
 await click(document.querySelector('input[value=FULL]') as HTMLInputElement);assert.ok(labelInput(labels[3]!).checked)
 await click(document.querySelector('input[value=UPLOADS]') as HTMLInputElement);assert.equal(Boolean(labelInput(labels[0]!)),false)
 await click(document.querySelector('input[value=IMAGES]') as HTMLInputElement)
 await fill(document.querySelector('textarea')!,'Refresh the website images.')
 await React.act(async()=>document.querySelector('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})))
 const rerun=rerunRequestSchema.parse(calls.startGeneration![0]![1]);assert.deepEqual(rerun.imageDirection?.styles,['people','local','illustration'])
 assert.ok(!rerunRequestSchema.safeParse({...rerun,imageDirection:{style:'invented'}}).success)
 assert.ok(intakeMediaSchema.safeParse({imageMode:'generate'}).success,'Legacy intake remains valid')
 console.log('PASS: intake checkbox combinations, mode switching, saved preferences and prompt; rerun restores preferences and submits them for images/full only; legacy compatibility.')
}finally{await React.act(async()=>root.unmount());for(const file of files){await unlink(file);await unlink(file.replace(/\.mjs$/,'.css')).catch(()=>{})};dom.window.close()}
