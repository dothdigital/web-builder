import {config} from 'dotenv'
config({path:'.env',quiet:true})
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {mkdir,writeFile,rm} from 'node:fs/promises'
import path from 'node:path'
import {encode} from 'next-auth/jwt'
import sharp from 'sharp'
import {websiteModelSchema} from '@awb/website-model'
import {getComponent,defaultTokens} from '@awb/component-registry'
import {localUploadRoot} from '@awb/shared'
const {prisma}=await import('@awb/database')
const {chromium}=await import('/tmp/webtummy-ui-check/node_modules/playwright/index.mjs')
const tag='editor-review-'+randomUUID()
const directory=path.join(localUploadRoot(),tag)
let workspace:any,user:any,browser:any,closing=false
try{
 workspace=await prisma.workspace.create({data:{name:tag,slug:tag,billingExempt:true,billingExemptionReason:'Isolated editor review verification'}})
 user=await prisma.user.create({data:{email:tag+'@example.invalid',name:'Editor review verification',emailVerified:new Date(),memberships:{create:{workspaceId:workspace.id,role:'OWNER'}}}})
 const project=await prisma.project.create({data:{workspaceId:workspace.id,name:tag,slug:tag,previewHost:tag+'.preview.local'}})
 const seed=await prisma.websiteVersion.findFirstOrThrow({where:{kind:'DRAFT'},orderBy:{createdAt:'asc'}})
 const model=websiteModelSchema.parse(seed.model)
 const header=getComponent('HeaderSplitUtility')!,footer=getComponent('FooterCompact')!,hero=getComponent('HeroEditorial')!,about=getComponent('AboutSplitOverlap')!
 const image='data:image/svg+xml;base64,'+Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="purple"/></svg>').toString('base64')
 model.site={name:'Editor review verification',previewHost:project.previewHost,locale:'en'};model.businessProfileRef=project.id;model.tokens=structuredClone(defaultTokens);model.contact={hours:[]};model.socials=[];model.navigation={primaryMenu:[]};model.customScripts=undefined
 model.globalComponents={header:{componentId:header.componentId,componentVersion:header.version,props:{...header.fixture as object,logoText:'Review verification',logoImageUrl:image}},footer:{componentId:footer.componentId,componentVersion:footer.version,props:{...footer.fixture as object,businessName:'Review verification',logoImageUrl:image}}} as any
 const heroSection=(heading:string)=>({id:'hero',componentId:hero.componentId,componentVersion:hero.version,hidden:false,props:{...hero.fixture as object,heading,imageUrl:image}})
 model.pages=[{id:'home',path:'/',title:'Home',h1:'Home',pageType:'CUSTOM',seo:{title:'Home',description:'Isolated editor review check',index:false},sections:[heroSection('Home'),{id:'services',componentId:'ServicesLargeNumbers',componentVersion:'1.0.0',hidden:false,props:{heading:'Service options',items:[{title:'About',href:'/about',imageUrl:''}]}}]},{id:'about',path:'/about',title:'About',h1:'About',pageType:'CUSTOM',seo:{title:'About',description:'Isolated editor review check',index:false},sections:[heroSection('About'),{id:'philosophy',componentId:about.componentId,componentVersion:about.version,hidden:false,props:{...about.fixture as object,heading:'Our philosophy',body:'',imageUrl:undefined,cta:undefined}},{id:'broken-picture',componentId:hero.componentId,componentVersion:hero.version,hidden:false,props:{...hero.fixture as object,heading:'Image health check',imageUrl:`/uploads/${tag}/missing.png`}}]}] as any
 await prisma.websiteVersion.create({data:{projectId:project.id,version:1,kind:'DRAFT',schemaVersion:model.schemaVersion,model:JSON.parse(JSON.stringify(model))}})
 await mkdir(directory,{recursive:true});const bytes=await sharp({create:{width:32,height:32,channels:4,background:'#123456'}}).png().toBuffer();await writeFile(path.join(directory,'sample.png'),bytes)
 const url=`/uploads/${tag}/sample.png`
 await prisma.asset.create({data:{workspaceId:workspace.id,projectId:project.id,kind:'IMAGE',source:'UPLOAD',storageKey:`${tag}/sample.png`,url,mimeType:'image/png',bytes:bytes.length}})
 const salt='__Secure-authjs.session-token',token=await encode({secret:process.env.AUTH_SECRET!,salt,token:{sub:user.id,sessionVersion:user.sessionVersion},maxAge:600})
 browser=await chromium.launch({headless:true,args:['--no-sandbox'],env:{...process.env,LD_LIBRARY_PATH:'/tmp/webtummy-browser-libs/root/usr/lib/x86_64-linux-gnu'}})
 const context=await browser.newContext({viewport:{width:1600,height:1000}})
 await context.addCookies([{name:salt,value:token,domain:'webtummy.com',path:'/',secure:true,httpOnly:true,sameSite:'Lax'}])
 const candidate=process.env.UI_CHECK_BASE
 if(candidate)await context.route('https://webtummy.com/**',async route=>{try{const response=await route.fetch({url:route.request().url().replace('https://webtummy.com',candidate),headers:{...route.request().headers(),host:'webtummy.com','x-forwarded-host':'webtummy.com','x-forwarded-proto':'https'},maxRedirects:0});await route.fulfill({response})}catch{if(!closing)await route.abort().catch(()=>{})}})
 const page=await context.newPage(),errors:string[]=[];page.on('pageerror',e=>errors.push(e.message))
 await page.goto(`https://webtummy.com/projects/${project.id}/editor`,{waitUntil:'networkidle'})
 let blockAiRequest=false, finishAiAbort:()=>void=()=>{}
 const aiAborted=new Promise<void>(resolve=>{finishAiAbort=resolve})
 await page.route('https://webtummy.com/projects/**/editor',async route=>{if(blockAiRequest && route.request().method()==='POST'){await route.abort();finishAiAbort()}else await route.fallback()})
 const openReview=async()=>{await page.getByRole('button',{name:'Review images & content',exact:true}).click();await page.getByRole('region',{name:'Review images and content'}).waitFor()}
 await openReview();let review=page.getByRole('region',{name:'Review images and content'})
 await review.getByRole('combobox').nth(1).selectOption('images')
 await review.getByRole('combobox').nth(0).selectOption('home')
 await review.locator('li').filter({hasText:'Service options'}).getByRole('button',{name:'Review / replace image',exact:true}).click()
 await page.getByRole('button',{name:'Update with AI',exact:true}).click()
 await page.getByLabel('What should the image show?',{exact:true}).fill('Create a landscape illustration of practical guidance for families.')
 blockAiRequest=true
 const aiRequest=page.waitForRequest(request=>request.method()==='POST'&&request.url().includes('/editor'))
 await page.getByRole('button',{name:'Generate image with AI',exact:true}).click()
 const payload=(await aiRequest).postData()??''
 assert.ok(payload.includes('"originalUrl":""'),'Inherited image updates compare against the actual empty saved field')
 assert.ok(payload.includes('"sectionId":"services"')&&payload.includes('"pointer":"/items/0/imageUrl"'),'AI update retains the exact review target')
 await aiAborted
 blockAiRequest=false
 await openReview();review=page.getByRole('region',{name:'Review images and content'})
 await review.getByRole('combobox').nth(0).selectOption('about')
 await review.locator('li').filter({hasText:'Our philosophy'}).filter({has:page.getByRole('button',{name:'Add image',exact:true})}).getByRole('button',{name:'Add image',exact:true}).click()
 assert.ok(await page.getByText('Upload image',{exact:true}).count()>0); assert.ok(await page.getByRole('button',{name:'Update with AI',exact:true}).count()>0)
 await page.getByRole('button',{name:/Choose from image library/}).click();await page.getByRole('button',{name:'Use sample.png',exact:true}).click()
 const photo=page.locator('[data-awb-section-id="philosophy"] img[data-awb-element="/imageUrl"]')
 await photo.waitFor();await page.waitForFunction(()=>{const i=document.querySelector<HTMLImageElement>('[data-awb-section-id="philosophy"] img[data-awb-element="/imageUrl"]');return i?.complete&&i.naturalWidth>0})
 await page.getByRole('button',{name:'Undo',exact:true}).click();assert.equal(await photo.count(),0)
 await openReview();review=page.getByRole('region',{name:'Review images and content'})
 await review.getByRole('combobox').nth(0).selectOption('about')
 await review.locator('li').filter({hasText:'Our philosophy'}).filter({has:page.getByRole('button',{name:'Add image',exact:true})}).getByRole('button',{name:'Add image',exact:true}).click()
 await page.getByRole('button',{name:/Choose from image library/}).click();await page.getByRole('button',{name:'Use sample.png',exact:true}).click()
 await openReview();review=page.getByRole('region',{name:'Review images and content'})
 await review.getByRole('combobox').nth(0).selectOption('about')
 await review.locator('li').filter({hasText:'Our philosophy'}).filter({has:page.getByRole('button',{name:'Add content',exact:true})}).getByRole('button',{name:'Add content',exact:true}).click()
 await page.locator('#editor-right-panel textarea').first().fill('Our team provides thoughtful, practical guidance.')
 await page.getByRole('button',{name:'Save',exact:true}).click();await page.getByText(/Saved as a new version/).waitFor()
 const saved=await prisma.websiteVersion.findFirstOrThrow({where:{projectId:project.id,kind:'DRAFT'},orderBy:{version:'desc'}})
 const section=(saved.model as any).pages.find((p:any)=>p.id==='about').sections.find((s:any)=>s.id==='philosophy')
 assert.equal(section.props.imageUrl,url);assert.equal(section.props.body,'Our team provides thoughtful, practical guidance.')
 await page.reload({waitUntil:'networkidle'});await openReview();review=page.getByRole('region',{name:'Review images and content'})
 await review.getByRole('combobox').nth(1).selectOption('all');await review.getByRole('combobox').nth(0).selectOption('about')
 assert.ok(await review.getByRole('button',{name:'Review / replace image',exact:true}).count()>0)
 assert.ok(await review.getByRole('button',{name:'Edit content',exact:true}).count()>0)
 await review.getByRole('combobox').nth(1).selectOption('images')
 await review.getByText('Image could not load. Open its controls to replace it.').waitFor()
 await review.getByRole('combobox').nth(1).selectOption('empty')
 assert.ok(await review.locator('li').filter({hasText:'Image health check'}).count()>0,'Failed image remains in attention view')
 await review.getByRole('combobox').nth(1).selectOption('all')
 await page.screenshot({path:'/tmp/editor-content-review-desktop.png',fullPage:true})
 assert.ok(await page.locator('#editor-right-panel').evaluate(e=>e.scrollWidth<=e.clientWidth+1),'Review sidebar must not overflow horizontally')
 assert.ok(await page.locator('#editor-right-panel nav button').evaluateAll(bs=>bs.every(b=>b.scrollWidth<=b.clientWidth+1)),'Property tabs must fit without overlapping text')
 assert.deepEqual(errors,[])
 console.log('PASS: cross-page review, absent image controls, image library selection and decoding, Undo, exact text editing, Save/reload persistence, existing-content review, and sidebar layout; temporary fixture only.')
}finally{closing=true;await browser?.close();if(workspace)await prisma.workspace.delete({where:{id:workspace.id}});if(user)await prisma.user.delete({where:{id:user.id}});await rm(directory,{recursive:true,force:true});await prisma.$disconnect()}
