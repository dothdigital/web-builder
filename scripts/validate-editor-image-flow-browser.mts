import { config } from 'dotenv'
config({ path: '.env', quiet: true })
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { encode } from 'next-auth/jwt'
import { websiteModelSchema } from '@awb/website-model'
import { getComponent, listComponents } from '@awb/component-registry'
const { prisma } = await import('@awb/database')
const { chromium } = await import('/tmp/webtummy-ui-check/node_modules/playwright/index.mjs')
const tag = `image-flow-${randomUUID()}`
const workspace = await prisma.workspace.create({ data: { name: tag, slug: tag, billingExempt: true, billingExemptionReason: 'Temporary isolated editor verification' } })
const user = await prisma.user.create({ data: { email: `${tag}@example.invalid`, name: 'Editor verification', emailVerified: new Date(), memberships: { create: { workspaceId: workspace.id, role: 'OWNER' } } } })
let browser: any, context: any, closing = false
const oldUrl='data:image/svg+xml;base64,'+Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="300" height="400"><rect width="300" height="400" fill="purple"/></svg>').toString('base64')
const newUrl='data:image/svg+xml;base64,'+Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="300" height="400"><rect width="300" height="400" fill="green"/></svg>').toString('base64')
try {
 const project=await prisma.project.create({data:{workspaceId:workspace.id,name:tag,slug:tag,previewHost:`${tag}.preview.local`}})
 const seed=await prisma.websiteVersion.findFirstOrThrow({where:{projectId:'cmv8r9j240000twpapiu39z6x',kind:'DRAFT'},orderBy:{version:'desc'}})
 const model=websiteModelSchema.parse(seed.model)
 const hero=getComponent('HeroEditorial')!,header=listComponents().find(c=>c.family==='HEADER')!,footer=listComponents().find(c=>c.family==='FOOTER')!
 model.site={name:tag,previewHost:project.previewHost,locale:'en'};model.businessProfileRef=project.id
 model.contact={hours:[]};model.socials=[];model.navigation={primaryMenu:[]}
 model.globalComponents={header:{componentId:header.componentId,componentVersion:header.version,props:header.fixture},footer:{componentId:footer.componentId,componentVersion:footer.version,props:footer.fixture}} as any
 model.pages=[{id:'home',path:'/',title:'Image test',h1:'Image test',pageType:'CUSTOM',seo:{title:'Image test',description:'Temporary editor image test.',index:true},sections:[{id:'hero',componentId:hero.componentId,componentVersion:hero.version,hidden:false,props:{...hero.fixture as object,heading:'Image test',imageUrl:oldUrl,imageAlt:'Original test image'}}]}] as any
 await prisma.websiteVersion.create({data:{projectId:project.id,version:1,kind:'DRAFT',schemaVersion:model.schemaVersion,model:JSON.parse(JSON.stringify(model))}})
 const job=await prisma.contentJob.create({data:{projectId:project.id,workspaceId:workspace.id,requestedBy:user.id,kind:'COVER',title:'Image update: synthetic verification',status:'RUNNING',startedAt:new Date(),runToken:tag,emailStatus:'SKIPPED',input:{purpose:'website',editorTarget:{pageId:'home',sectionId:'hero',pointer:'/imageUrl',originalUrl:oldUrl}}}})
 const salt='__Secure-authjs.session-token'
 const token=await encode({secret:process.env.AUTH_SECRET!,salt,token:{sub:user.id,sessionVersion:user.sessionVersion},maxAge:600})
 browser=await chromium.launch({headless:true,args:['--no-sandbox'],env:{...process.env,LD_LIBRARY_PATH:'/tmp/webtummy-browser-libs/root/usr/lib/x86_64-linux-gnu'}})
 context=await browser.newContext({viewport:{width:1440,height:1000}})
 await context.addCookies([{name:salt,value:token,domain:'webtummy.com',path:'/',secure:true,httpOnly:true,sameSite:'Lax'}])
 const candidate=process.env.UI_CHECK_BASE
 if(candidate)await context.route('https://webtummy.com/**',async(route:any)=>{try{const response=await route.fetch({url:route.request().url().replace('https://webtummy.com',candidate),headers:{...route.request().headers(),host:'webtummy.com','x-forwarded-host':'webtummy.com','x-forwarded-proto':'https'},maxRedirects:0});await route.fulfill({response})}catch{if(!closing)await route.abort().catch(()=>{})}})
 const page=await context.newPage(), errors:string[]=[]
 page.on('pageerror',(e:Error)=>errors.push(e.message))
 await page.goto(`https://webtummy.com/projects/${project.id}/editor`)
 const overlay=page.getByRole('dialog',{name:'Generating your image…'})
 await overlay.waitFor()
 assert.ok(await page.locator('[data-awb-editor-root]').evaluate((root:HTMLElement)=>root.inert))
 await page.reload()
 await overlay.waitFor()
 assert.ok(await page.locator('[data-awb-editor-root]').evaluate((root:HTMLElement)=>root.inert),'Refresh restores the pending job and blocks editor actions')
 await prisma.contentJob.update({where:{id:job.id},data:{status:'READY',result:{url:newUrl,alt:'Generated test image'},finishedAt:new Date()}})
 await page.evaluate(()=>window.dispatchEvent(new Event('awb-content-queued')))
 await overlay.waitFor({state:'detached',timeout:25000})
 const image=page.locator('[data-awb-section-id="hero"] img[data-awb-element="/imageUrl"]')
 assert.equal(await image.getAttribute('src'),newUrl)
 assert.equal(await image.getAttribute('alt'),'Generated test image')
 assert.equal(await page.locator('[data-awb-editor-root]').evaluate((root:HTMLElement)=>root.inert),false)
 await page.getByRole('button',{name:'Save',exact:true}).click()
 await page.getByRole('button',{name:'Saved',exact:true}).waitFor()
 assert.equal((await prisma.contentJob.findUniqueOrThrow({where:{id:job.id}})).status,'APPLIED')
 const latest=await prisma.websiteVersion.findFirstOrThrow({where:{projectId:project.id,kind:'DRAFT'},orderBy:{version:'desc'}})
 const saved=websiteModelSchema.parse(latest.model)
 assert.equal(saved.pages[0]!.sections[0]!.props.imageUrl,newUrl)
 const fail=await prisma.contentJob.create({data:{projectId:project.id,workspaceId:workspace.id,requestedBy:user.id,kind:'COVER',title:'Image update: synthetic failure',status:'RUNNING',startedAt:new Date(),runToken:tag,emailStatus:'SKIPPED',input:{}}})
 await page.evaluate(()=>window.dispatchEvent(new Event('awb-content-queued')));await overlay.waitFor()
 await prisma.contentJob.update({where:{id:fail.id},data:{status:'FAILED',error:'Synthetic generation failure',finishedAt:new Date()}})
 await page.evaluate(()=>window.dispatchEvent(new Event('awb-content-queued')));await overlay.waitFor({state:'detached',timeout:25000})
 assert.equal(await image.getAttribute('src'),newUrl,'Failure keeps the current image')
 assert.equal(await page.locator('[data-awb-editor-root]').evaluate((root:HTMLElement)=>root.inert),false)
 await page.getByRole('button',{name:/^page$/i}).click()
 await page.getByLabel('H1',{exact:true}).fill('Focused page heading')
 await page.getByLabel('Target keyword',{exact:true}).fill('focused service')
 await page.getByLabel('Secondary keywords (comma separated)',{exact:true}).fill('local focused service')
 assert.equal(await page.locator('[data-awb-section-id="hero"] h1').textContent(),'Focused page heading')
 await page.getByRole('button',{name:'Save',exact:true}).click()
 await page.getByRole('button',{name:'Saved',exact:true}).waitFor()
 const seoVersion=await prisma.websiteVersion.findFirstOrThrow({where:{projectId:project.id,kind:'DRAFT'},orderBy:{version:'desc'}})
 const seo=websiteModelSchema.parse(seoVersion.model).pages[0]!.seo
 assert.equal(seo.targetKeyword,'focused service');assert.equal(seo.secondaryKeywords,'local focused service')
 assert.deepEqual(errors,[])
 console.log('PASS: real browser restores the fullscreen loader across refresh, automatically replaces the original slot without an open image panel/library step, saves the image and marks its job applied; failures unlock the editor and retain the current image. No AI generation, billing or emails triggered.')
}finally{closing=true;await context?.unrouteAll({behavior:'ignoreErrors'});await browser?.close();await prisma.workspace.delete({where:{id:workspace.id}});await prisma.user.delete({where:{id:user.id}});await prisma.$disconnect()}
