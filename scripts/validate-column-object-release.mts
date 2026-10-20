import {copyWebsitePage,suggestPageCopy} from '../apps/web/src/lib/copy-page'
import {createBlankPage} from '../apps/web/src/lib/blank-page'
import {config} from 'dotenv'
config({path:'.env',quiet:true})
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {mkdir,writeFile,rm} from 'node:fs/promises'
import path from 'node:path'
import {encode} from 'next-auth/jwt'
import sharp from 'sharp'
import {websiteModelSchema,validateWebsiteModel} from '@awb/website-model'
import {getComponent,defaultTokens} from '@awb/component-registry'
import {localUploadRoot} from '@awb/shared'
const {prisma}=await import('@awb/database')
const {chromium}=await import('/tmp/webtummy-ui-check/node_modules/playwright/index.mjs')
const tag='section-columns-'+randomUUID()
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
 const initialCopy=copyWebsitePage(model,'home',{title:'Home copy',path:'/home-copy',addToNavigation:false},'home-copy')
 assert.deepEqual(initialCopy.model.pages.at(-1)!.sections.map(section=>section.props),model.pages[0]!.sections.map(section=>section.props))
 assert.notEqual(initialCopy.model.pages.at(-1)!.sections[0]!.id,model.pages[0]!.sections[0]!.id)
 assert.equal(suggestPageCopy(initialCopy.model,model.pages[0]!).path,'/home-copy-2')
 initialCopy.model.pages.at(-1)!.sections[0]!.props.heading='Independent'
 assert.equal(model.pages[0]!.sections[0]!.props.heading,'Home')
 assert.throws(()=>copyWebsitePage(model,'home',{title:'Collision',path:'/about',addToNavigation:false},'collision'),/already exists/)
 const originalPages=JSON.stringify(model.pages)
 const emptyDraft=createBlankPage(model,{title:'Empty draft',slug:'empty-draft',addToNavigation:false},'empty-draft')
 assert.equal(emptyDraft.model.pages.at(-1)!.sections.length,0)
 assert.ok(validateWebsiteModel(emptyDraft.model,{allowBlankPages:true}).valid)
 assert.ok(!validateWebsiteModel(emptyDraft.model).valid,'AI generation must still reject accidental empty pages')
 assert.deepEqual(emptyDraft.model.navigation,websiteModelSchema.parse(model).navigation)
 assert.deepEqual(emptyDraft.model.globalComponents,websiteModelSchema.parse(model).globalComponents)
 assert.equal(JSON.stringify(model.pages),originalPages)
 assert.throws(()=>createBlankPage(emptyDraft.model,{title:'Duplicate',slug:'empty-draft',addToNavigation:true},'duplicate'),/already exists/)
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

 await page.getByRole('button',{name:/^Select page:/}).first().click()
 await page.getByRole('button',{name:'Copy page: Home',exact:true}).first().click()
 const copy=page.getByRole('dialog',{name:'Copy page',exact:true})
 await copy.getByRole('textbox',{name:'New page name',exact:true}).fill('Live URL check')
 assert.equal(await copy.getByRole('textbox',{name:'New page URL',exact:true}).inputValue(),'/live-url-check')
 await copy.getByRole('button',{name:'Create page copy',exact:true}).click()
 await page.getByRole('button',{name:'Select page: Live URL check, /live-url-check',exact:true}).first().waitFor()
 if (!await page.getByRole('textbox',{name:'Page name',exact:true}).isVisible()) await page.locator('button[aria-controls="editor-right-panel"]').click()
 await page.getByRole('button',{name:'page',exact:true}).click().catch(()=>{})
 await page.getByRole('textbox',{name:'Page name',exact:true}).fill('Updated live name')
 assert.equal(await page.getByRole('textbox',{name:/^Page URL/}).inputValue(),'/updated-live-name')
 for (const count of [2,3,4,5]) {
  await page.getByRole('button',{name:'+ Add object',exact:true}).click()
  const add=page.getByRole('dialog',{name:'Add object',exact:true})
  await add.getByRole('button',{name:'Columns',exact:true}).click()
  await add.getByLabel('New object columns',{exact:true}).selectOption(String(count))
  await add.getByRole('button',{name:'Add columns',exact:true}).click()
  const grid=page.locator(`[data-awb-object-columns="${count}"]`).last()
  await grid.waitFor()
  for (const width of [90,60,30]) {
   await grid.evaluate((element,width)=>{const free=element.closest('[data-awb-free-item]') as HTMLElement;if(free)free.style.setProperty('--free-width',width+'%');else (element as HTMLElement).style.width=width+'%'},width)
   const boxes=await grid.locator(':scope > div').evaluateAll(elements=>elements.map(element=>{const b=element.getBoundingClientRect();return {x:b.x,y:b.y,right:b.right}}))
   assert.equal(boxes.length,count)
   assert.ok(boxes.every(box=>Math.abs(box.y-boxes[0]!.y)<1),`${count} columns at ${width}% must remain on one row`)
   assert.ok(boxes.every((box,i)=>i===0||box.x>=boxes[i-1]!.right-1),'No column overlap')
  }
 }
 await page.getByRole('button',{name:'Save',exact:true}).click()
 await page.getByText(/Saved as a new version/).waitFor()
 const saved=await prisma.websiteVersion.findFirstOrThrow({where:{projectId:project.id,kind:'DRAFT'},orderBy:{version:'desc'}})
 const renamed=(saved.model as any).pages.find((entry:any)=>entry.path==='/updated-live-name')
 assert.equal(renamed.title,'Updated live name')
 const objects=renamed.sections.flatMap((section:any)=>[...(section.props.items??[]),...(section.props.freeElements??[]).flatMap((entry:any)=>entry.content?.items??[])])
 assert.ok(objects.some((item:any)=>item.kind==='columns'&&item.columns.length===4))
 await page.reload({waitUntil:'networkidle'})
 assert.deepEqual(errors,[])
 console.log('PASS: page URLs plus 2/3/4/5 columns in one row, desktop resizing at 30/60/90 percent, no overlap, save/reload; fixture cleaned up.')
}finally{closing=true;await browser?.close();if(workspace)await prisma.workspace.delete({where:{id:workspace.id}});if(user)await prisma.user.delete({where:{id:user.id}});await rm(directory,{recursive:true,force:true});await prisma.$disconnect()}
