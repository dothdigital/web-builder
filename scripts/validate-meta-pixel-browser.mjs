import assert from 'node:assert/strict'
import {chromium} from '/tmp/webtummy-ui-check/node_modules/playwright/index.mjs'
import {mkdirSync} from 'node:fs'
const base=process.env.META_CHECK_BASE||'http://127.0.0.1:3003'
const browser=await chromium.launch({headless:true,args:['--no-sandbox'],env:{...process.env,LD_LIBRARY_PATH:'/tmp/webtummy-browser-libs/root/usr/lib/x86_64-linux-gnu'}})
const key='webtummy-advertising-consent-v1',pixelId='3004331693237487'
const contexts=[]
async function fixture({choice,signal=false,delay=0}={}){
 const context=await browser.newContext({viewport:{width:1440,height:1000}});contexts.push(context)
 if(choice)await context.addInitScript(({key,choice})=>{localStorage.setItem(key,JSON.stringify({choice,expires:Date.now()+1000000}))},{key,choice})
 if(signal)await context.addInitScript(()=>Object.defineProperty(navigator,'globalPrivacyControl',{value:true}))
 let loads=0
 await context.route('https://connect.facebook.net/**',async route=>{loads++;if(delay)await new Promise(resolve=>setTimeout(resolve,delay));return route.fulfill({contentType:'application/javascript',body:`window.__metaCalls=[];const f=window.fbq;let locked=false;const flush=()=>{while(f.queue.length&&!locked)f.callMethod(...f.queue.shift())};f.callMethod=(...args)=>{if(args[0]==='consent'){window.__metaCalls.push(args);locked=args[1]==='revoke';if(!locked)flush()}else if(locked)f.queue.push(args);else window.__metaCalls.push(args)};flush();`})})
 const page=await context.newPage();page.setDefaultTimeout(10000)
 return {context,page,loads:()=>loads}
}
const calls=page=>page.evaluate(()=>window.__metaCalls||[])
const pageviews=async page=>(await calls(page)).filter(a=>a[0]==='trackSingle')
try{
 const f=await fixture();const {page}=f
 await page.goto(base,{waitUntil:'networkidle'})
 assert.equal(f.loads(),0,'No Meta script before consent')
 assert.ok(await page.getByRole('region',{name:'Advertising cookie preferences'}).isVisible())
 await page.getByRole('button',{name:'Reject optional',exact:true}).click()
 await page.reload({waitUntil:'networkidle'})
 assert.equal(f.loads(),0,'Rejection persists without contacting Meta')
 await page.getByRole('button',{name:'Cookie settings',exact:true}).click()
 await page.getByRole('button',{name:'Accept advertising',exact:true}).click()
 await page.waitForFunction(()=>window.__metaCalls?.some(a=>a[0]==='trackSingle'))
 assert.equal(f.loads(),1)
 assert.equal((await pageviews(page)).length,1,'Exactly one initial PageView')
 assert.deepEqual((await calls(page)).find(a=>a[0]==='init'),['init',pixelId],'No advanced matching identifiers supplied')
 assert.deepEqual((await calls(page)).find(a=>a[1]==='autoConfig'),['set','autoConfig',false,pixelId])
 assert.equal(await page.evaluate(()=>window.fbq.disablePushState),true)
 await page.locator('header a[href="/pricing"]').click();await page.waitForURL('**/pricing')
 await page.waitForFunction(()=>window.__metaCalls.filter(a=>a[0]==='trackSingle').length===2)
 assert.equal(f.loads(),1,'SPA navigation does not load the script twice')
 await page.getByRole('button',{name:'Cookie settings',exact:true}).click()
 await page.getByRole('button',{name:'Reject optional',exact:true}).click()
 await page.locator('header a[href="/contact"]').click();await page.waitForURL('**/contact')
 assert.equal((await pageviews(page)).length,2,'No further PageView after withdrawal')
 assert.ok((await calls(page)).some(a=>a[0]==='consent'&&a[1]==='revoke'))
 console.log('Consent, persistence, exactly-once SPA pageviews, advanced-matching opt-out and withdrawal passed.')
 // A second open tab must respect withdrawals saved by the first tab.
 const tab=await f.context.newPage();await tab.goto(base,{waitUntil:'networkidle'});assert.equal(await tab.locator('#webtummy-meta-pixel').count(),0)
 await page.getByRole('button',{name:'Cookie settings',exact:true}).click();await page.getByRole('button',{name:'Accept advertising',exact:true}).click()
 await tab.waitForFunction(()=>window.__metaCalls?.some(a=>a[0]==='trackSingle'))
 await page.getByRole('button',{name:'Cookie settings',exact:true}).click();await page.getByRole('button',{name:'Reject optional',exact:true}).click()
 await tab.waitForFunction(()=>window.__metaCalls?.at(-1)?.[0]==='consent'&&window.__metaCalls?.at(-1)?.[1]==='revoke')
 console.log('Cross-tab consent changes passed.')
 const slow=await fixture({delay:1200});await slow.page.goto(base,{waitUntil:'networkidle'});await slow.page.getByRole('button',{name:'Accept advertising',exact:true}).click();await slow.page.getByRole('button',{name:'Cookie settings',exact:true}).click();await slow.page.getByRole('button',{name:'Reject optional',exact:true}).click();await slow.page.waitForFunction(()=>window.fbq?.callMethod);await slow.page.waitForTimeout(150);assert.equal((await pageviews(slow.page)).length,0,'Withdrawal during SDK load must discard the pending event');await slow.page.getByRole('button',{name:'Cookie settings',exact:true}).click();await slow.page.getByRole('button',{name:'Accept advertising',exact:true}).click();await slow.page.waitForFunction(()=>window.__metaCalls?.some(a=>a[0]==='trackSingle'));assert.equal((await pageviews(slow.page)).length,1);console.log('Delayed SDK loading, rapid withdrawal and re-acceptance passed with Meta-style consent queue locking.')

 for(const route of ['/signin','/privacy?token=private-test','/signup?email=private%40example.com','/contact#private-test']){
  const f=await fixture({choice:'accepted'});await f.page.goto(base+route,{waitUntil:'networkidle'});assert.equal(f.loads(),0,`No Meta script on ${route}`)
 }
 console.log('Authentication and sensitive URL exclusion passed.')
 const gpc=await fixture({choice:'accepted',signal:true});await gpc.page.goto(base,{waitUntil:'networkidle'});assert.equal(gpc.loads(),0);await gpc.page.getByRole('button',{name:'Cookie settings'}).click();assert.equal(await gpc.page.getByRole('button',{name:'Accept advertising'}).count(),0)
 console.log('Browser privacy preference overrides saved advertising consent.')
 const fail=await fixture();await fail.page.addInitScript(()=>{Storage.prototype.getItem=()=>{throw new Error('blocked')};Storage.prototype.setItem=()=>{throw new Error('blocked')}});await fail.page.goto(base,{waitUntil:'networkidle'});assert.equal(fail.loads(),0);await fail.page.getByRole('button',{name:'Reject optional',exact:true}).click()
 mkdirSync('/tmp/webtummy-pixel-check',{recursive:true});await fail.page.getByRole('button',{name:'Cookie settings'}).click()
 for(const width of [1440,390]){await fail.page.setViewportSize({width,height:900});assert.ok(await fail.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await fail.page.screenshot({path:`/tmp/webtummy-pixel-check/consent-${width}.png`})}
 console.log('Storage restrictions and desktop/mobile banner layout passed. No actual Meta events sent by this suite.')
}finally{for(const c of contexts)await c.close();await browser.close()}
