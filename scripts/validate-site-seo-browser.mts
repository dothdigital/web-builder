import { config } from 'dotenv'
config({ path: '.env', quiet: true })
import assert from 'node:assert/strict'
import { encode } from 'next-auth/jwt'
import { websiteModelSchema } from '@awb/website-model'
const { prisma } = await import('@awb/database')
const { chromium } = await import('/tmp/webtummy-ui-check/node_modules/playwright/index.mjs')
const projectId='cmv8r9j240000twpapiu39z6x'
let browser:any,context:any,closing=false
try {
 const project=await prisma.project.findUniqueOrThrow({where:{id:projectId},include:{workspace:{include:{members:{include:{user:true}}}}}})
 const version=await prisma.websiteVersion.findFirstOrThrow({where:{projectId,kind:'DRAFT'},orderBy:{version:'desc'}})
 const model=websiteModelSchema.parse(version.model)
 const user=project.workspace.members.find(member=>member.role==='OWNER')!.user
 const salt='__Secure-authjs.session-token'
 const token=await encode({secret:process.env.AUTH_SECRET!,salt,token:{sub:user.id,sessionVersion:user.sessionVersion},maxAge:600})
 browser=await chromium.launch({headless:true,args:['--no-sandbox'],env:{...process.env,LD_LIBRARY_PATH:'/tmp/webtummy-browser-libs/root/usr/lib/x86_64-linux-gnu'}})
 context=await browser.newContext({viewport:{width:1440,height:1000}})
 await context.addCookies([{name:salt,value:token,domain:'webtummy.com',path:'/',secure:true,httpOnly:true,sameSite:'Lax'}])
 const candidate=process.env.UI_CHECK_BASE
 if(candidate)await context.route('https://webtummy.com/**',async(route:any)=>{try{const response=await route.fetch({url:route.request().url().replace('https://webtummy.com',candidate),headers:{...route.request().headers(),host:'webtummy.com','x-forwarded-host':'webtummy.com','x-forwarded-proto':'https'},maxRedirects:0});await route.fulfill({response})}catch{if(!closing)await route.abort().catch(()=>{})}})
 const page=await context.newPage(), errors:string[]=[]
 page.on('pageerror',(error:Error)=>errors.push(error.message))
 for(const expected of model.pages) {
  await page.goto(`https://webtummy.com/preview/${projectId}${expected.path==='/'?'':expected.path}`,{waitUntil:'domcontentloaded'})
  try { await page.waitForFunction((title:string)=>document.title===title,expected.seo.title,{timeout:15000}) } catch { throw new Error(`${expected.path}: metadata title ${await page.title()} expected ${expected.seo.title}`) }
  await page.locator('[data-section-id]').first().waitFor()
  const result=await page.evaluate(()=>{
   const headings=[...document.querySelectorAll('h1')].filter(node=>node.getClientRects().length>0&&getComputedStyle(node).visibility!=='hidden').map(node=>node.textContent?.trim())
   const structured=[...document.querySelectorAll('script[type="application/ld+json"]')].flatMap(script=>{const value=JSON.parse(script.textContent||'null');return Array.isArray(value)?value:[value]})
   const faq=structured.find(data=>data?.['@type']==='FAQPage')
   return {headings,title:document.title,description:document.querySelector('meta[name=description]')?.getAttribute('content'),robots:document.querySelector('meta[name=robots]')?.getAttribute('content'),faqCount:faq?.mainEntity?.length||0,faqVisible:faq?.mainEntity?.every((question:any)=>document.body.textContent?.includes(question.name)&&document.body.textContent?.includes(question.acceptedAnswer.text)),pageSchema:structured.some(data=>data?.['@graph']?.some((node:any)=>node['@id']?.endsWith('#webpage')))}
  })
  assert.equal(result.headings.length,1,`${expected.path}: ${JSON.stringify(result.headings)}`)
  assert.equal(result.headings[0],expected.h1,expected.path)
  assert.equal(result.description,expected.seo.description,expected.path)
  assert.match(result.robots||'',/noindex/)
  assert.ok(result.pageSchema&&result.faqCount>0&&result.faqVisible,expected.path)
 }
 assert.deepEqual(errors,[])
 console.log(JSON.stringify({browser:'PASS',pages:model.pages.length,eachPage:'unique metadata; exactly one visible matching H1; page schema; visible factual FAQ and matching FAQ schema; private preview noindex',sourceVersion:version.version}))
}finally{closing=true;await context?.unrouteAll({behavior:'ignoreErrors'});await browser?.close();await prisma.$disconnect()}
