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
 await page.mouse.move(grip.x+9,grip.y+9);await page.mouse.down();await page.mouse.move(grip.x-31,grip.y+1,{steps:12});await page.waitForTimeout(80)
 const live=(await picture.boundingBox())!;assert.ok(live.width<before.width-15,'Real editor resizes the picture before release')
 await page.mouse.up();await page.waitForTimeout(150)
 const moved=page.locator('[data-awb-section-id="hero"] [data-awb-free-item] img');await moved.waitFor()
 const persisted=(await moved.boundingBox())!;assert.ok(Math.abs(persisted.width-live.width)<3,'Release retains the visible image size')
 await page.getByRole('button',{name:'Save',exact:true}).click();await page.getByRole('button',{name:'Saved',exact:true}).waitFor()
 await page.reload();await moved.waitFor();await moved.click();await page.waitForTimeout(150);assert.ok(Math.abs((await moved.boundingBox())!.width-persisted.width)<3,'Saved image size survives reload')
 await moved.scrollIntoViewIfNeeded();await moved.click();
 const stableCanvas=await page.locator('[data-awb-canvas-scroll]').evaluate((el:HTMLElement)=>{const b=el.getBoundingClientRect();return {x:b.x,y:b.y,width:b.width,height:b.height,scrollTop:el.scrollTop}})
 const stableImage=(await moved.boundingBox())!
 await page.locator('#editor-left-panel').evaluate(el=>el.scrollTop=el.scrollHeight)
 await page.getByRole('toolbar',{name:'image controls',exact:true}).getByRole('button',{name:'Size',exact:true}).click()
 assert.ok(await page.getByRole('slider',{name:'Object width',exact:true}).isVisible(),'Moved image uses a width slider')
 const imageToolbar=page.getByRole('region',{name:'image settings',exact:true})
 assert.deepEqual(await page.locator('[data-awb-canvas-scroll]').evaluate((el:HTMLElement)=>{const b=el.getBoundingClientRect();return {x:b.x,y:b.y,width:b.width,height:b.height,scrollTop:el.scrollTop}}),stableCanvas,'Opening a tool preserves canvas size, position and scroll')
 assert.deepEqual(await moved.boundingBox(),stableImage,'Opening a tool keeps the selected object in place')
 assert.equal(await page.locator('#editor-left-panel').evaluate(el=>el.scrollTop),0,'Tool starts at the top instead of inheriting Sections scroll')
 assert.ok(await imageToolbar.getByRole('radio',{name:'Width',exact:true}).isChecked(),'Width is selected by default')
 assert.equal(await imageToolbar.getByRole('slider',{name:'Object height',exact:true}).count(),0,'Height stays hidden until selected')
 await imageToolbar.getByRole('radio',{name:'Height',exact:true}).check()
 assert.equal(await imageToolbar.getByRole('slider',{name:'Object width',exact:true}).count(),0,'Width is hidden when Height is selected')
 const heightSlider=imageToolbar.getByRole('slider',{name:'Object height',exact:true});await heightSlider.waitFor()
 const optionBox=(await imageToolbar.getByRole('radio',{name:'Height',exact:true}).boundingBox())!,controlBox=(await heightSlider.boundingBox())!
 assert.ok(controlBox.x>optionBox.x+100,'Selected controls use the empty space to the right of the radio options')
 async function styleObject(element:any,kind:string,shadow:string){
  await element.evaluate((el:HTMLElement)=>el.click())
  const toolbar=page.getByRole('toolbar',{name:kind+' controls',exact:true});await toolbar.waitFor()
  await toolbar.getByRole('button',{name:'Appearance',exact:true}).click()
  const controls=page.getByRole('region',{name:kind+' settings',exact:true});await controls.waitFor()
  await controls.getByRole('radio',{name:'Rounded corners',exact:true}).check()
  const radius=controls.getByRole('slider',{name:'Corner radius',exact:true});await radius.focus();await radius.press('Home');for(let i=0;i<24;i++)await radius.press('ArrowRight')
  assert.equal(await element.evaluate((el:HTMLElement)=>getComputedStyle(el).borderRadius),'24px',kind+' gets rounded corners')
  await page.locator('#editor-left-panel').evaluate(el=>el.scrollTop=el.scrollHeight)
  await controls.getByRole('radio',{name:'Border',exact:true}).check()
  assert.equal(await page.locator('#editor-left-panel').evaluate(el=>el.scrollTop),0,'Changing appearance options restores the controls to the top')
  assert.equal(await radius.count(),0,'Only the selected appearance controls are shown')
  const border=controls.getByRole('slider',{name:'Border width',exact:true});await border.focus();await border.press('Home');for(let i=0;i<3;i++)await border.press('ArrowRight')
  assert.equal(await element.evaluate((el:HTMLElement)=>getComputedStyle(el).borderWidth),'3px',kind+' gets a visible border')
  await controls.getByRole('radio',{name:'Shadow',exact:true}).check();await controls.getByRole('radio',{name:shadow,exact:true}).check()
  await controls.getByLabel('Shadow colour hex code',{exact:true}).fill('#336699');await controls.getByLabel('Shadow colour hex code',{exact:true}).press('Tab')
  const distance=controls.getByRole('slider',{name:'Shadow distance',exact:true});await distance.press('Home');for(let i=0;i<12;i++)await distance.press('ArrowRight')
  assert.match(await element.evaluate((el:HTMLElement,kind:string)=>kind==='text'?getComputedStyle(el).textShadow:getComputedStyle(el).boxShadow,kind),/51, 102, 153.*0px 12px/)
  await controls.getByLabel('Shadow effect',{exact:true}).selectOption('raised')
  const opacity=controls.getByRole('slider',{name:'Shadow opacity',exact:true});await opacity.press('Home');for(let i=0;i<60;i++)await opacity.press('ArrowRight')
  assert.match(await element.evaluate((el:HTMLElement,kind:string)=>kind==='text'?getComputedStyle(el).textShadow:getComputedStyle(el).boxShadow,kind),/0px -12px/)
  if(kind==='text')assert.equal(await element.evaluate((el:HTMLElement)=>getComputedStyle(el).boxShadow),'none')
  assert.ok((await element.evaluate((el:HTMLElement,kind:string)=>kind==='text'?getComputedStyle(el).textShadow:getComputedStyle(el).boxShadow,kind))!=='none',kind+' gets a shadow')
 }
 await styleObject(moved,'image','Medium')
 const dockedBox=(await page.getByRole('region',{name:'image settings',exact:true}).boundingBox())!,canvasBox=(await page.locator('[data-awb-canvas-scroll]').boundingBox())!,quickBox=(await page.getByRole('toolbar',{name:'image controls',exact:true}).boundingBox())!
 assert.ok(dockedBox.x+dockedBox.width<=canvasBox.x+1,'Tool settings replace the left sidebar without covering the object')
 assert.ok(quickBox.y+quickBox.height<=canvasBox.y+1,'Quick toolbar stays above the canvas')
 assert.ok(await page.locator('#editor-left-panel').evaluate(el=>el.scrollWidth<=el.clientWidth+1),'Tool controls fit the left sidebar')
 assert.equal(await page.getByRole('button',{name:'+ Add object',exact:true}).isVisible(),false,'Sections contents are replaced, not placed underneath the tool')
 await page.getByRole('button',{name:'← Sections Close settings ×',exact:true}).click()
 assert.equal(await page.getByRole('region',{name:'image settings',exact:true}).count(),0,'User can close the tool panel')
 assert.ok(await page.getByRole('button',{name:'+ Add object',exact:true}).isVisible(),'Closing the panel restores Sections')
 assert.ok(await page.getByRole('toolbar',{name:'image controls',exact:true}).isVisible(),'Closing keeps the object selected')
 await page.getByRole('toolbar',{name:'image controls',exact:true}).getByRole('button',{name:'Appearance',exact:true}).click()
 await page.getByRole('region',{name:'image settings',exact:true}).getByRole('radio',{name:'Shadow',exact:true}).check()
 mkdirSync('/tmp/webtummy-object-controls-release',{recursive:true});await page.screenshot({path:'/tmp/webtummy-object-controls-release/'+(candidate?'candidate':'live')+'-shadow.png'})
 const heading=page.locator('[data-awb-section-id="hero"] [data-awb-element="/heading"]')
 const button=page.locator('[data-awb-section-id="hero"] [data-awb-element="/primaryCta"]')
 await styleObject(heading,'text','Soft');await styleObject(button,'button','Strong')
 await page.getByRole('button',{name:'Save',exact:true}).click();await page.getByRole('button',{name:'Saved',exact:true}).waitFor()
 await page.reload();await moved.waitFor()
 for(const element of [moved,heading,button]){const style=await element.evaluate((el:HTMLElement)=>{const s=getComputedStyle(el);return {radius:s.borderRadius,width:s.borderWidth,shadow:el.matches('h1,h2,h3,h4,h5,h6,p')?s.textShadow:s.boxShadow}});assert.equal(style.radius,'24px');assert.equal(style.width,'3px');assert.match(style.shadow,/51, 102, 153.*0px -12px/)}
 await moved.evaluate((el:HTMLElement)=>el.click());await page.getByRole('toolbar',{name:'image controls',exact:true}).getByRole('button',{name:'Size',exact:true}).click()
 const layoutDir='/tmp/webtummy-object-controls-release';mkdirSync(layoutDir,{recursive:true});await page.screenshot({path:layoutDir+(candidate?'/candidate-desktop.png':'/live-desktop.png'),fullPage:false})
 await page.setViewportSize({width:390,height:900});await page.waitForTimeout(150)
 const mobileToolbar=page.getByRole('toolbar',{name:'image controls',exact:true}),mobileBox=(await mobileToolbar.boundingBox())!
 assert.ok(mobileBox.x>=0&&mobileBox.x+mobileBox.width<=391,'Toolbar stays inside the mobile viewport')
 await mobileToolbar.getByRole('radio',{name:'Height',exact:true}).check();await mobileToolbar.getByRole('slider',{name:'Object height',exact:true}).waitFor()
 await page.screenshot({path:layoutDir+(candidate?'/candidate-mobile.png':'/live-mobile.png'),fullPage:false})

 const dir='/tmp/webtummy-image-controls-release';mkdirSync(dir,{recursive:true});await page.screenshot({path:dir+(candidate?'/candidate.png':'/live.png'),fullPage:false})
 assert.deepEqual(errors,[])
 console.log('PASS: size radios reveal one control at a time in a side-by-side desktop layout; image, text and button corners/borders/shadows persist after save/reload; mobile toolbar stays inside the viewport; live image resizing still works.')
}finally{closing=true;await context?.unrouteAll({behavior:'ignoreErrors'});await browser?.close();await prisma.workspace.delete({where:{id:workspace.id}});if(user)await prisma.user.delete({where:{id:user.id}});await prisma.$disconnect()}
