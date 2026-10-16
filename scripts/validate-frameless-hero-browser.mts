import { config } from 'dotenv'
config({ path: '.env', quiet: true })
import assert from 'node:assert/strict'
import { mkdirSync } from 'node:fs'
import { encode } from 'next-auth/jwt'
const { prisma } = await import('@awb/database')
const { chromium } = await import('/tmp/webtummy-ui-check/node_modules/playwright/index.mjs')
const projectId='cmv8r9j240000twpapiu39z6x'
let browser:any, context:any, closing=false
try {
 const project=await prisma.project.findUniqueOrThrow({where:{id:projectId},include:{workspace:{include:{members:{include:{user:true}}}}}})
 const user=project.workspace.members.find(m=>m.role==='OWNER')!.user
 const salt='__Secure-authjs.session-token'
 const token=await encode({secret:process.env.AUTH_SECRET!,salt,token:{sub:user.id,sessionVersion:user.sessionVersion},maxAge:300})
 browser=await chromium.launch({headless:true,args:['--no-sandbox'],env:{...process.env,LD_LIBRARY_PATH:'/tmp/webtummy-browser-libs/root/usr/lib/x86_64-linux-gnu'}})
 context=await browser.newContext({viewport:{width:1440,height:1000}})
 await context.addCookies([{name:salt,value:token,domain:'webtummy.com',path:'/',secure:true,httpOnly:true,sameSite:'Lax'}])
 const candidate=process.env.UI_CHECK_BASE
 if(candidate)await context.route('https://webtummy.com/**',async(route:any)=>{try{const response=await route.fetch({url:route.request().url().replace('https://webtummy.com',candidate),headers:{...route.request().headers(),host:'webtummy.com','x-forwarded-host':'webtummy.com','x-forwarded-proto':'https'},maxRedirects:0});await route.fulfill({response})}catch{if(!closing)await route.abort().catch(()=>{})}})
 const page=await context.newPage()
 await page.goto(`https://webtummy.com/preview/${projectId}`,{waitUntil:'networkidle'})
 const img=page.locator('img[src*="whatsapp-image"]').first()
 const check=async()=>{
  const state=await img.evaluate((image:HTMLImageElement)=>{const frame=image.closest('[data-awb-image-container]');const style=getComputedStyle(image),outer=frame?getComputedStyle(frame):undefined;return{loaded:image.complete&&image.naturalWidth>0,fit:style.objectFit,shadow:outer?.boxShadow??'none',border:outer?.borderTopWidth??'0px',radius:outer?.borderTopLeftRadius??'0px',background:outer?.backgroundColor??'rgba(0, 0, 0, 0)'}})
  assert.ok(state.loaded);assert.equal(state.fit,'contain');assert.equal(state.shadow,'none');assert.equal(state.border,'0px');assert.equal(state.radius,'0px');assert.equal(state.background,'rgba(0, 0, 0, 0)')
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1))
 }
 const dir=process.env.IMAGE_UI_ARTIFACTS||'/tmp/webtummy-frameless-hero-check';mkdirSync(dir,{recursive:true})
 await check();await page.screenshot({path:`${dir}/desktop.png`,fullPage:true})
 await page.setViewportSize({width:390,height:844});await check();await page.screenshot({path:`${dir}/mobile.png`,fullPage:true})
 console.log('PASS: visible moved hero image has no frame background, shadow, border or rounding; full uploaded image loads without cropping on desktop/mobile.')
}finally{closing=true;await context?.unrouteAll({behavior:'ignoreErrors'});await browser?.close();await prisma.$disconnect()}
