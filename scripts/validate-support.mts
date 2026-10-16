import assert from 'node:assert/strict'
import { existsSync, mkdirSync } from 'node:fs'
import { guides, categories, guideScreenshots } from '../apps/web/src/app/support/guides'
import { videos } from '../apps/web/src/app/support/videos'
const { chromium } = await import('/tmp/webtummy-ui-check/node_modules/playwright/index.mjs')
const base=process.env.SUPPORT_CHECK_BASE ?? 'http://127.0.0.1:3010'
assert.equal(new Set(guides.map(g=>g.slug)).size,guides.length,'Guide URLs must be unique')
for(const guide of guides){assert.ok(categories.some(c=>c.id===guide.category));assert.ok(guide.steps.length>=3);assert.ok(existsSync(`apps/web/public/support/${guide.image}.webp`),`Screenshot missing: ${guide.image}`)}
for(const views of Object.values(guideScreenshots))for(const [image] of views)assert.ok(existsSync(`apps/web/public/support/${image}.webp`),image)
for(const video of videos){assert.ok(existsSync(`apps/web/public/support/videos/${video.id}.webm`),video.id);assert.ok(existsSync(`apps/web/public/support/videos/${video.id}.vtt`),video.id)}
const browser=await chromium.launch({headless:true,args:['--no-sandbox'],env:{...process.env,LD_LIBRARY_PATH:'/tmp/webtummy-browser-libs/root/usr/lib/x86_64-linux-gnu'}})
try {
 const page=await browser.newPage({viewport:{width:1440,height:1000}})
 const errors:string[]=[];page.on('pageerror',(e:Error)=>errors.push(e.message))
 const response=await page.goto(`${base}/support`);assert.equal(response?.status(),200)
 await page.getByRole('heading',{level:1}).waitFor()
 const search=page.getByRole('searchbox',{name:'Search support guides'})
 await search.fill('add page');await page.waitForTimeout(200)
 assert.ok(await page.getByRole('link',{name:/Add a new website page/}).isVisible())
 await search.fill('xyzzynonexistent');await page.getByRole('heading',{name:'No matching guides yet.'}).waitFor()
 await page.getByRole('button',{name:'Reset search',exact:true}).click()
 await page.getByRole('button',{name:/Sections & layouts/}).click()
 assert.equal(await page.getByRole('link',{name:/Add a new website page/}).count(),0)
 assert.ok(await page.getByRole('link',{name:/Add a section with AI/}).isVisible())
 await page.goto(`${base}/support/add-page`)
 await page.getByRole('heading',{level:1,name:'Add a new website page'}).waitFor()
 await page.getByRole('button',{name:/Enlarge screenshot/}).first().click();await page.getByRole('dialog').waitFor()
 await page.keyboard.press('Escape');assert.equal(await page.getByRole('dialog').count(),0)
 const screenshot=page.locator('figure img').first();assert.ok(await screenshot.evaluate((n:HTMLImageElement)=>n.complete&&n.naturalWidth>0))
 const video=page.locator('video');await video.evaluate((n:HTMLVideoElement)=>n.load());await page.waitForFunction(()=>document.querySelector('video')!.readyState>=1);assert.ok(await video.evaluate((n:HTMLVideoElement)=>n.duration>10));await video.evaluate((n:HTMLVideoElement)=>{n.currentTime=5});await page.waitForTimeout(400);assert.ok(await video.evaluate((n:HTMLVideoElement)=>n.currentTime>=4));assert.ok(await page.locator('track[kind=captions]').count());await video.evaluate((n:HTMLVideoElement)=>{n.textTracks[0].mode='showing'});await page.waitForFunction(()=>document.querySelector('track')!.readyState===2)
 await page.getByRole('navigation',{name:'On this page'}).getByRole('link').nth(1).click();assert.ok(page.url().endsWith('#step-2'))
 const dir='/tmp/webtummy-support-check';mkdirSync(dir,{recursive:true})
 await page.goto(`${base}/support`);await page.screenshot({path:`${dir}/desktop.png`,fullPage:true});await page.screenshot({path:`${dir}/desktop-viewport.png`})
 await page.setViewportSize({width:390,height:844})
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),'Mobile help center must fit viewport')
 await page.screenshot({path:`${dir}/mobile.png`,fullPage:true})
 await page.goto(`${base}/support/add-page`)
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),'Mobile article must fit viewport')
 await page.screenshot({path:`${dir}/article-mobile.png`,fullPage:true})
 const missing=await page.goto(`${base}/support/no-such-guide`);assert.equal(missing?.status(),404)
 // Verify every published guide URL and referenced screenshot, without account access.
 for(const guide of guides){const r=await page.request.get(`${base}/support/${guide.slug}`);assert.equal(r.status(),200,guide.slug);const html=await r.text();assert.ok(html.includes(guide.title.replaceAll('&','&amp;')),guide.slug);const image=await page.request.get(`${base}/support/${guide.image}.webp`);assert.equal(image.status(),200,guide.image)}
 for(const clip of videos){
  const range=await page.request.get(`${base}/support/videos/${clip.id}.webm`,{headers:{Range:'bytes=0-127'}});assert.equal(range.status(),206,`Video range requests must support seeking: ${clip.id}`)
  const captions=await page.request.get(`${base}/support/videos/${clip.id}.vtt`);assert.equal(captions.status(),200);assert.ok((await captions.text()).startsWith('WEBVTT'))
  const state=await page.evaluate(async url=>{const player=document.createElement('video');player.muted=true;player.preload='auto';player.src=url;document.body.append(player);try{await new Promise<void>((resolve,reject)=>{player.addEventListener('loadeddata',()=>resolve(),{once:true});player.addEventListener('error',()=>reject(new Error('Video decode error')),{once:true});player.load()});await player.play();await new Promise(r=>setTimeout(r,700));return{duration:player.duration,width:player.videoWidth,time:player.currentTime,error:player.error?.message}}finally{player.pause();player.remove()}},`${base}/support/videos/${clip.id}.webm`)
  assert.ok(state.duration>10&&state.width>0&&state.time>0&&!state.error,`Video must decode and play: ${clip.id}`)
 }
 assert.deepEqual(errors,[])
 console.log(`PASS: ${guides.length} guide routes and screenshots, public access, search, category filtering, empty-state reset, image lightbox and Escape, step anchors, 404, desktop/mobile overflow, all six videos decode/play with captions, no browser exceptions.`)
}finally{await browser.close()}
