import dotenv from 'dotenv'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {encode} from 'next-auth/jwt'
dotenv.config({path:'.env',quiet:true})
const {prisma}=await import('@awb/database')
const {websiteModelSchema}=await import('@awb/website-model')
const {getComponent,defaultTokens}=await import('@awb/component-registry')
const {chromium}=await import('/tmp/webtummy-ui-check/node_modules/playwright/index.mjs')
const tag='service-card-link-'+randomUUID()
let workspace:any,browser:any
try{
 workspace=await prisma.workspace.create({data:{name:tag,slug:tag,billingExempt:true,billingExemptionReason:'Isolated column arrangement verification'}})
 const user=await prisma.user.create({data:{email:tag+'@example.invalid',name:'Column arrangement check',emailVerified:new Date(),memberships:{create:{workspaceId:workspace.id,role:'OWNER'}}}})
 const project=await prisma.project.create({data:{workspaceId:workspace.id,name:tag,slug:tag,previewHost:tag+'.preview.local'}})
 const seed=await prisma.websiteVersion.findFirstOrThrow({where:{kind:'DRAFT'},orderBy:{createdAt:'asc'}})
 const model=websiteModelSchema.parse(seed.model)
 model.site={name:'Column arrangement check',previewHost:project.previewHost,locale:'en'}
 model.businessProfileRef=project.id;model.tokens=structuredClone(defaultTokens);model.contact={hours:[]};model.socials=[];model.navigation={primaryMenu:[]};model.customScripts=undefined;model.businessDetails=undefined
 const header=getComponent('HeaderSplitUtility')!,footer=getComponent('FooterCompact')!
 model.globalComponents={header:{componentId:header.componentId,componentVersion:header.version,props:header.fixture},footer:{componentId:footer.componentId,componentVersion:footer.version,props:footer.fixture}} as any
 model.pages=[{id:'home',path:'/',title:'Quote options',h1:'Quote options',pageType:'CUSTOM',seo:{title:'Quote options',description:'Column arrangement check',index:false},sections:[{id:'quote-cards',componentId:'ServicesLargeNumbers',componentVersion:'1.0.0',hidden:false,props:{heading:'Get a quote',intro:'Choose an option.',items:Array.from({length:4},(_,i)=>({title:`Quote ${i+1}`,href:'/quote'}))}}]}]
 await prisma.websiteVersion.create({data:{projectId:project.id,version:1,kind:'DRAFT',schemaVersion:model.schemaVersion,model:JSON.parse(JSON.stringify(model))}})
 const salt='__Secure-authjs.session-token'
 const token=await encode({secret:process.env.AUTH_SECRET!,salt,token:{sub:user.id,sessionVersion:user.sessionVersion},maxAge:600})
 browser=await chromium.launch({headless:true,args:['--no-sandbox'],env:{...process.env,LD_LIBRARY_PATH:'/tmp/webtummy-browser-libs/root/usr/lib/x86_64-linux-gnu'}})
 const context=await browser.newContext({viewport:{width:1800,height:1100}})
 await context.addCookies([{name:salt,value:token,domain:'webtummy.com',path:'/',secure:true,httpOnly:true,sameSite:'Lax'}])
 if(process.env.UI_CHECK_BASE)await context.route('https://webtummy.com/**',async route=>{
  const response=await route.fetch({url:route.request().url().replace('https://webtummy.com',process.env.UI_CHECK_BASE!),headers:{...route.request().headers(),host:'webtummy.com','x-forwarded-host':'webtummy.com','x-forwarded-proto':'https'},maxRedirects:0});await route.fulfill({response})
 })
 const page=await context.newPage();const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message))
 await page.goto(`https://webtummy.com/projects/${project.id}/editor`,{waitUntil:'networkidle'})
 const root=page.locator('[data-awb-section-content] [data-awb-element="/layout/0"]').first()
 await root.dispatchEvent('click')
 await page.getByRole('button',{name:'Layout',exact:true}).click()
 const arrangement=page.getByRole('combobox',{name:'Container arrangement',exact:true})
 for(const count of [4,1,2,3,4]){
  await arrangement.selectOption(String(count))
  await page.waitForFunction(count=>{
   const els=Array.from(document.querySelectorAll('[data-awb-section-content] ol>li'))
   return els.length===4 && els.filter(e=>Math.abs(e.getBoundingClientRect().y-els[0].getBoundingClientRect().y)<1).length===count
  },count)
 }
 const link=page.locator('[data-awb-section-content] [data-awb-element="/items/0/link"]')
 await link.dispatchEvent('click')
 const buttonStyle=page.getByRole('combobox',{name:'Button style',exact:true})
 assert.equal(await buttonStyle.inputValue(),'text-link')
 await buttonStyle.selectOption('solid')
 await page.getByRole('button',{name:'Edit text / link',exact:true}).click()
 await page.getByRole('region',{name:'button settings',exact:true}).getByRole('textbox').first().fill('Get a quote')
 await page.getByLabel('Link',{exact:true}).fill('/super-visa-insurance')
 assert.equal(await link.getAttribute('href'),'/super-visa-insurance')
 assert.equal(await link.textContent(),'Get a quote')
 const buttonAppearance=await link.evaluate(e=>({bg:getComputedStyle(e).backgroundColor,decoration:getComputedStyle(e).textDecorationLine}))
 assert.notEqual(buttonAppearance.bg,'rgba(0, 0, 0, 0)')
 assert.equal(buttonAppearance.decoration,'none')
 assert.equal(await page.locator('[data-awb-section-content] [data-awb-element="/items/1/link"]').evaluate(e=>getComputedStyle(e).textDecorationLine),'underline')
 await page.getByRole('button',{name:'Save',exact:true}).click()
 await page.getByRole('button',{name:'Saved',exact:true}).waitFor()
 await page.reload({waitUntil:'networkidle'})
 const boxes=await page.locator('[data-awb-section-content] ol>li').evaluateAll(els=>els.map(e=>e.getBoundingClientRect().y))
 assert.equal(boxes.length,4);assert.ok(boxes.every(y=>Math.abs(y-boxes[0])<1),'Saved/reloaded editor keeps four columns')
 const saved=await prisma.websiteVersion.findFirstOrThrow({where:{projectId:project.id},orderBy:{version:'desc'}})
 assert.equal((saved.model as any).pages[0].sections[0].props.elementColors['/layout/0'].layoutColumns,4)
 assert.deepEqual((saved.model as any).pages[0].sections[0].props.items[0].link,{label:'Get a quote',href:'/super-visa-insurance',variant:'solid'})
 assert.equal(await page.locator('[data-awb-section-content] [data-awb-element="/items/0/link"]').textContent(),'Get a quote')
 assert.deepEqual(errors,[])
 await page.screenshot({path:'/tmp/service-card-link-editor.png',fullPage:true})
 console.log('PASS: individually selectable legacy card link, solid-button control, edit text/destination, save/reload, neighboring links unchanged, four-column layout retained, no client errors.')
}finally{
 if(browser)await browser.close()
 if(workspace){const members=await prisma.workspaceMember.findMany({where:{workspaceId:workspace.id},select:{userId:true}});await prisma.workspace.delete({where:{id:workspace.id}});await prisma.user.deleteMany({where:{id:{in:members.map(x=>x.userId)}}})}
 await prisma.$disconnect()
}
