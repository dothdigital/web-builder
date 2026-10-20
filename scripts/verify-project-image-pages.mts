import {config} from 'dotenv'
config({path:'.env',quiet:true})
import assert from 'node:assert/strict'
import {writeFile} from 'node:fs/promises'
import {encode} from 'next-auth/jwt'
import {websiteModelSchema,repeatedPageImages} from '@awb/website-model'
const {prisma}=await import('@awb/database')
const {chromium}=await import('/tmp/webtummy-ui-check/node_modules/playwright/index.mjs')
const projectId='cmveaqdzq003awhpa0cwv4dxt'
let browser:any
try{
 const project=await prisma.project.findUniqueOrThrow({where:{id:projectId}})
 const owner=await prisma.workspaceMember.findFirstOrThrow({where:{workspaceId:project.workspaceId,role:'OWNER'},include:{user:true}})
 const version=await prisma.websiteVersion.findFirstOrThrow({where:{projectId,kind:'DRAFT'},orderBy:{version:'desc'}})
 const model=websiteModelSchema.parse(version.model)
 assert.equal(repeatedPageImages(model).length,0)
 const salt='__Secure-authjs.session-token'
 const token=await encode({secret:process.env.AUTH_SECRET!,salt,token:{sub:owner.user.id,sessionVersion:owner.user.sessionVersion},maxAge:1200})
 browser=await chromium.launch({headless:true,args:['--no-sandbox'],env:{...process.env,LD_LIBRARY_PATH:'/tmp/webtummy-browser-libs/root/usr/lib/x86_64-linux-gnu'}})
 const context=await browser.newContext({viewport:{width:1440,height:1000}})
 await context.addCookies([{name:salt,value:token,domain:'webtummy.com',path:'/',secure:true,httpOnly:true,sameSite:'Lax'}])
 const page=await context.newPage()
 const report=[]
 for(const entry of model.pages){
  const response=await page.goto(`https://webtummy.com/preview/${projectId}${entry.path==='/'?'':entry.path}`,{waitUntil:'domcontentloaded'})
  assert.equal(response?.status(),200,entry.path)
  await page.locator('main').waitFor()
  const images=await page.locator('main img').evaluateAll(async nodes=>{
   const imgs=nodes as HTMLImageElement[]
   imgs.forEach(img=>img.loading='eager')
   await Promise.all(imgs.map(img=>Promise.race([img.decode().catch(()=>{}),new Promise(resolve=>setTimeout(resolve,15000))])))
   return imgs.map(img=>({src:img.currentSrc||img.src,loaded:img.complete&&img.naturalWidth>0,alt:img.alt}))
  })
  const broken=images.filter((img:any)=>!img.loaded)
  assert.deepEqual(broken,[],`Images must load on ${entry.path}`)
  const urls=images.map((img:any)=>img.src.split(/[?#]/)[0])
  assert.equal(urls.length,new Set(urls).size,`Rendered content images must be distinct on ${entry.path}`)
  if(entry.path==='/insurance/life-insurance')await page.screenshot({path:'/tmp/webtummy-life-insurance-distinct-images.png',fullPage:true})
  report.push({path:entry.path,images:images.length,loaded:true,repeated:0})
  console.log(`PASS ${entry.path}: ${images.length} loaded, distinct content images`)
 }
 await writeFile('/tmp/webtummy-image-pages-verification.json',JSON.stringify({version:version.version,pages:report},null,2))
}finally{await browser?.close();await prisma.$disconnect()}
