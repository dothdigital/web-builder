import { config } from 'dotenv'
config({ path: '.env', quiet: true })
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import { encode } from 'next-auth/jwt'
import { websiteModelSchema } from '@awb/website-model'
import { getComponent, listComponents } from '@awb/component-registry'
const { prisma } = await import('@awb/database')
const { chromium } = await import('/tmp/webtummy-ui-check/node_modules/playwright/index.mjs')
const tag='image-release-'+randomUUID()
const workspace=await prisma.workspace.create({data:{name:tag,slug:tag,billingExempt:true,billingExemptionReason:'Isolated deployment verification'}})
let user:any,browser:any,context:any,closing=false
try{
 user=await prisma.user.create({data:{email:tag+'@example.invalid',name:'Image resize verification',emailVerified:new Date(),memberships:{create:{workspaceId:workspace.id,role:'OWNER'}}}})
 const project=await prisma.project.create({data:{workspaceId:workspace.id,name:tag,slug:tag,previewHost:tag+'.preview.local'}})
 const seed=await prisma.websiteVersion.findFirstOrThrow({where:{kind:'DRAFT'},orderBy:{createdAt:'asc'}})
 const model=websiteModelSchema.parse(seed.model)
 const hero=getComponent('HeroSplitBooking')!,header=listComponents('HEADER')[0]!,footer=listComponents('FOOTER')[0]!
 const image='data:image/svg+xml;base64,'+Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="240"><rect width="1200" height="240" fill="purple"/></svg>').toString('base64')
 model.site={name:'Resize verification',previewHost:project.previewHost,locale:'en'};model.businessProfileRef=project.id
 model.contact={hours:[]};model.socials=[];model.navigation={primaryMenu:[]}
 model.globalComponents={header:{componentId:header.componentId,componentVersion:header.version,props:{...header.fixture as object,logoText:'Resize verification',logoImageUrl:image}},footer:{componentId:footer.componentId,componentVersion:footer.version,props:{...footer.fixture as object,businessName:'Resize verification',logoImageUrl:image}}} as any
 model.pages=[{id:'home',path:'/',title:'Resize verification',h1:'Resize verification',pageType:'CUSTOM',seo:{title:'Resize verification',description:'Temporary isolated deployment verification.',index:false},sections:[{id:'hero',componentId:hero.componentId,componentVersion:hero.version,hidden:false,props:{...hero.fixture as object,heading:'Resize verification',imageUrl:image,imageAlt:'Synthetic wide image'}}]}] as any
 await prisma.websiteVersion.create({data:{projectId:project.id,version:1,kind:'DRAFT',schemaVersion:model.schemaVersion,model:JSON.parse(JSON.stringify(model))}})
 const salt='__Secure-authjs.session-token',token=await encode({secret:process.env.AUTH_SECRET!,salt,token:{sub:user.id,sessionVersion:user.sessionVersion},maxAge:600})
 browser=await chromium.launch({headless:true,args:['--no-sandbox'],env:{...process.env,LD_LIBRARY_PATH:'/tmp/webtummy-browser-libs/root/usr/lib/x86_64-linux-gnu'}})
 context=await browser.newContext({viewport:{width:1440,height:1000}})
 await context.addCookies([{name:salt,value:token,domain:'webtummy.com',path:'/',secure:true,httpOnly:true,sameSite:'Lax'}])
 const candidate=process.env.UI_CHECK_BASE
 if(candidate)await context.route('https://webtummy.com/**',async route=>{try{const response=await route.fetch({url:route.request().url().replace('https://webtummy.com',candidate),headers:{...route.request().headers(),host:'webtummy.com','x-forwarded-host':'webtummy.com','x-forwarded-proto':'https'},maxRedirects:0});await route.fulfill({response})}catch{if(!closing)await route.abort().catch(()=>{})}})
 const page=await context.newPage(),errors:string[]=[];page.on('pageerror',e=>errors.push(e.message))
 await page.goto('https://webtummy.com/projects/'+project.id+'/editor')
 const picture=page.locator('[data-awb-section-id="hero"] img[data-awb-element="/imageUrl"]')
 await picture.waitFor();await picture.scrollIntoViewIfNeeded();await picture.click()
 const toolbar=page.getByRole('toolbar',{name:'image controls',exact:true});await toolbar.waitFor()
 assert.ok(await toolbar.evaluate(el=>getComputedStyle(el).fontSize==='14px'),'Modern toolbar uses readable text')
 const handle=page.getByRole('button',{name:'Resize image from bottom right',exact:true});await handle.waitFor();await page.waitForTimeout(150)
 const before=await picture.evaluate((img:HTMLImageElement)=>{const b=img.getBoundingClientRect();const factor=Math.min(b.width/img.naturalWidth,b.height/img.naturalHeight),width=img.naturalWidth*factor,height=img.naturalHeight*factor;return {x:b.x+(b.width-width)/2,y:b.y+(b.height-height)/2,width,height}})
 const grip=(await handle.boundingBox())!
 assert.ok(Math.abs(grip.x+9-before.x-before.width)<3,'Hero corner matches the visible picture width')
 assert.ok(Math.abs(grip.y+9-before.y-before.height)<3,'Hero corner matches the visible picture height')
 await page.mouse.move(grip.x+9,grip.y+9);await page.mouse.down();await page.mouse.move(grip.x+49,grip.y+17,{steps:12});await page.waitForTimeout(80)
 const live=(await picture.boundingBox())!;assert.ok(live.width>before.width+15,'Real editor resizes the picture before release')
 await page.mouse.up();await page.waitForTimeout(150)
 const moved=page.locator('[data-awb-section-id="hero"] [data-awb-free-item] img');await moved.waitFor()
 const persisted=(await moved.boundingBox())!;assert.ok(Math.abs(persisted.width-live.width)<3,'Release retains the visible image size')
 await page.getByRole('button',{name:'Save',exact:true}).click();await page.getByRole('button',{name:'Saved',exact:true}).waitFor()
 await page.reload();await moved.waitFor();assert.ok(Math.abs((await moved.boundingBox())!.width-persisted.width)<3,'Saved image size survives reload')
 await moved.scrollIntoViewIfNeeded();await moved.click();await page.getByRole('toolbar',{name:'image controls',exact:true}).getByRole('button',{name:'Size',exact:true}).click()
 assert.ok(await page.getByRole('slider',{name:'Object width',exact:true}).isVisible(),'Moved image uses a width slider')
 const dir='/tmp/webtummy-image-controls-release';mkdirSync(dir,{recursive:true});await page.screenshot({path:dir+(candidate?'/candidate.png':'/live.png'),fullPage:false})
 assert.deepEqual(errors,[])
 console.log('PASS: authenticated production editor shows the modern toolbar, hero grips follow painted edges, image resizes live, release commits, saved size survives reload, and moved image sliders are available.')
}finally{closing=true;await context?.unrouteAll({behavior:'ignoreErrors'});await browser?.close();await prisma.workspace.delete({where:{id:workspace.id}});if(user)await prisma.user.delete({where:{id:user.id}});await prisma.$disconnect()}
