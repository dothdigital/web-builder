import {config} from 'dotenv'
config({path:'.env',quiet:true})
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {encode} from 'next-auth/jwt'
const {prisma}=await import('@awb/database')
const {chromium}=await import('/tmp/webtummy-ui-check/node_modules/playwright/index.mjs')
const {projectId,userId}=JSON.parse(readFileSync('/tmp/webtummy-support-demo.json','utf8'))
const user=await prisma.user.findUniqueOrThrow({where:{id:userId}})
assert.equal(user.isPlatformAdmin,false);assert.equal(user.isPlatformSupport,false)
const salt='__Secure-authjs.session-token';const token=await encode({secret:process.env.AUTH_SECRET!,salt,token:{sub:user.id,sessionVersion:user.sessionVersion},maxAge:300})
const browser=await chromium.launch({headless:true,args:['--no-sandbox'],env:{...process.env,LD_LIBRARY_PATH:'/tmp/webtummy-browser-libs/root/usr/lib/x86_64-linux-gnu'}})
let ctx:any,closing=false
try{
 ctx=await browser.newContext({viewport:{width:1440,height:1000}})
 await ctx.addCookies([{name:salt,value:token,domain:'webtummy.com',path:'/',secure:true,httpOnly:true,sameSite:'Lax'}])
 const candidate=process.env.SUPPORT_CHECK_BASE
 await ctx.route('https://webtummy.com/**',async r=>{try{if(!['GET','HEAD'].includes(r.request().method()))return r.abort();if(!candidate)return r.continue();const response=await r.fetch({url:r.request().url().replace('https://webtummy.com',candidate),headers:{...await r.request().allHeaders(),host:'webtummy.com','x-forwarded-host':'webtummy.com','x-forwarded-proto':'https'},maxRedirects:0});return r.fulfill({response})}catch{if(!closing)await r.abort().catch(()=>{})}})
 const page=await ctx.newPage();const errors:string[]=[];page.on('pageerror',(e:Error)=>errors.push(e.message))
 await page.goto('https://webtummy.com/dashboard');await page.getByRole('heading',{name:'Willow Studio',exact:true}).waitFor()
 assert.equal(await page.locator('.wt-sidebar').getByRole('link',{name:'Help & support',exact:true}).getAttribute('href'),'/support')
 assert.equal(await page.locator('.wt-sidebar').getByText('PLATFORM ADMIN',{exact:true}).count(),0)
 await page.goto(`https://webtummy.com/projects/${projectId}/editor`)
 await page.locator('[data-awb-section-id="hero"]').waitFor()
 const help=page.getByRole('link',{name:'Help ↗',exact:true});assert.equal(await help.getAttribute('href'),'/support/editor-tour');assert.equal(await help.getAttribute('target'),'_blank')
 assert.deepEqual(errors,[])
 console.log('PASS: normal demo customer sees Help & support in dashboard and Help in editor; no platform admin navigation; no browser exceptions.')
}finally{closing=true;await ctx?.unrouteAll({behavior:'ignoreErrors'});await browser.close();await prisma.user.update({where:{id:userId},data:{sessionVersion:{increment:1}}});await prisma.$disconnect()}
