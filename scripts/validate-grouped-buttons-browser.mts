import dotenv from 'dotenv'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {encode} from 'next-auth/jwt'
dotenv.config({path:'.env',quiet:true})
const {prisma}=await import('@awb/database')
const {websiteModelSchema}=await import('@awb/website-model')
const {getComponent,defaultTokens}=await import('@awb/component-registry')
const {chromium}=await import('/tmp/webtummy-ui-check/node_modules/playwright/index.mjs')
const tag='group-move-'+randomUUID()
let workspace:any,browser:any
try{
 workspace=await prisma.workspace.create({data:{name:tag,slug:tag,billingExempt:true,billingExemptionReason:'Isolated column arrangement verification'}})
 const user=await prisma.user.create({data:{email:tag+'@example.invalid',name:'Column arrangement check',emailVerified:new Date(),memberships:{create:{workspaceId:workspace.id,role:'OWNER'}}}})
 const project=await prisma.project.create({data:{workspaceId:workspace.id,name:tag,slug:tag,previewHost:tag+'.preview.local'}})
 const seed=await prisma.websiteVersion.findFirstOrThrow({where:{projectId:'cmveaqdzq003awhpa0cwv4dxt',kind:'DRAFT'},orderBy:{version:'desc'}})
 const model=websiteModelSchema.parse(seed.model)
 model.site={name:'Column arrangement check',previewHost:project.previewHost,locale:'en'}
 model.businessProfileRef=project.id;model.tokens=structuredClone(defaultTokens);model.contact={hours:[]};model.socials=[];model.navigation={primaryMenu:[]};model.customScripts=undefined;model.businessDetails=undefined
 const header=getComponent('HeaderSplitUtility')!,footer=getComponent('FooterCompact')!
 model.globalComponents={header:{componentId:header.componentId,componentVersion:header.version,props:header.fixture},footer:{componentId:footer.componentId,componentVersion:footer.version,props:footer.fixture}} as any
 const source=structuredClone(model.pages.find(p=>p.path==='/online-quote')!)
 source.id='home';source.path='/'
 source.sections[0]!.props.elementGroups=[]
 model.pages=[source]

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
 const frame=page.locator('[data-awb-section-content]').first()
 const paths=['/items/0/link','/freeElements/0','/freeElements/1','/freeElements/2']
 const boxes=async()=>Promise.all(paths.map(path=>frame.locator(`[data-awb-element="${path}"]`).boundingBox()))
 for(const path of paths)await frame.locator(`[data-awb-element="${path}"]`).dispatchEvent('click',{shiftKey:true})
 const toolbar=page.getByRole('toolbar',{name:'Multiple object controls'})
 await toolbar.getByRole('button',{name:'Group',exact:true}).click()
 await toolbar.getByRole('button',{name:'Deselect',exact:true}).click()
 for(const path of paths.slice(0,2))await frame.locator(`[data-awb-element="${path}"]`).dispatchEvent('click',{shiftKey:true})
 const before=await boxes()
 const button=frame.locator('[data-awb-element="/items/0/link"]')
 await button.scrollIntoViewIfNeeded()
 const initial=await boxes()
 const b=initial[0]!
 await page.mouse.move(b.x+b.width/2,b.y+b.height/2)
 await page.mouse.down();await page.mouse.move(b.x+b.width/2+15,b.y+b.height/2+40,{steps:8});await page.mouse.up()
 const after=await boxes()
 console.log('DRAG',initial.map((b,i)=>({path:paths[i],dx:after[i]!.x-b!.x,dy:after[i]!.y-b!.y})))
 await page.screenshot({path:'/tmp/group-move-debug.png',fullPage:true})
 for(let i=0;i<4;i++)assert.ok(Math.abs(after[i]!.y-initial[i]!.y-40)<2,`All four buttons should move together: ${paths[i]}`)
 await page.getByRole('button',{name:'Save',exact:true}).click()
 await page.getByRole('button',{name:'Saved',exact:true}).waitFor()
 await page.reload({waitUntil:'networkidle'})
 const copy=frame.locator('[data-awb-element="/freeElements/2/content/items/0/link"]')
 await copy.dispatchEvent('click')
 await toolbar.getByRole('button',{name:'Ungroup',exact:true}).waitFor()
 await copy.scrollIntoViewIfNeeded()
 const reloadBefore=await boxes(),c=(await copy.boundingBox())!
 await page.mouse.move(c.x+c.width/2,c.y+c.height/2)
 await page.mouse.down();await page.mouse.move(c.x+c.width/2-10,c.y+c.height/2+25,{steps:8});await page.mouse.up()
 const reloadAfter=await boxes()
 for(let i=0;i<4;i++)assert.ok(Math.abs(reloadAfter[i]!.y-reloadBefore[i]!.y-25)<2,`Dragging a copied member after reload must move the whole group: ${paths[i]}`)
 await page.getByRole('button',{name:'Undo',exact:true}).click()
 const undone=await boxes()
 for(let i=0;i<4;i++)assert.ok(Math.abs(undone[i]!.y-reloadBefore[i]!.y)<2,'One Undo restores all four positions')
 await page.getByRole('button',{name:'Redo',exact:true}).click()
 const redone=await boxes()
 for(let i=0;i<4;i++)assert.ok(Math.abs(redone[i]!.y-reloadAfter[i]!.y)<2,'One Redo moves all four again')
 const saved=await prisma.websiteVersion.findFirstOrThrow({where:{projectId:project.id},orderBy:{version:'desc'}})

 assert.deepEqual(errors,[])
 await page.screenshot({path:'/tmp/grouped-buttons-editor.png',fullPage:true})
 console.log('PASS: reproduced partial selection now expands to all four; original/copy drags, saved-group reload, one-step Undo/Redo, no client errors.')
}finally{
 if(browser){for(const context of browser.contexts())await context.unrouteAll({behavior:'ignoreErrors'});await browser.close()}
 if(workspace){const members=await prisma.workspaceMember.findMany({where:{workspaceId:workspace.id},select:{userId:true}});await prisma.workspace.delete({where:{id:workspace.id}});await prisma.user.deleteMany({where:{id:{in:members.map(x=>x.userId)}}})}
 await prisma.$disconnect()
}
