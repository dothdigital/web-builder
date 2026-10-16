import { config } from 'dotenv'
config({path:'.env',quiet:true})
import { readFileSync, mkdirSync, writeFileSync, copyFileSync, existsSync } from 'node:fs'
import { encode } from 'next-auth/jwt'
const {prisma}=await import('@awb/database')
const {chromium}=await import('/tmp/webtummy-ui-check/node_modules/playwright/index.mjs')
const {projectId,userId}=JSON.parse(readFileSync('/tmp/webtummy-support-demo.json','utf8'))
const user=await prisma.user.findUniqueOrThrow({where:{id:userId}})
if(user.isPlatformAdmin||user.isPlatformSupport)throw new Error('Use a normal customer account')
const salt='__Secure-authjs.session-token'
const token=await encode({secret:process.env.AUTH_SECRET!,salt,token:{sub:user.id,sessionVersion:user.sessionVersion},maxAge:2400})
const output='apps/web/public/support/videos';mkdirSync(output,{recursive:true});mkdirSync('/tmp/webtummy-support-raw-video',{recursive:true})
const browser=await chromium.launch({headless:true,args:['--no-sandbox'],env:{...process.env,LD_LIBRARY_PATH:'/tmp/webtummy-browser-libs/root/usr/lib/x86_64-linux-gnu'}})
type Cue={start:number;end:number;text:string}
const results:any[]=[]
function timestamp(seconds:number){const ms=Math.round(seconds*1000);return `${String(Math.floor(ms/3600000)).padStart(2,'0')}:${String(Math.floor(ms/60000)%60).padStart(2,'0')}:${String(Math.floor(ms/1000)%60).padStart(2,'0')}.${String(ms%1000).padStart(3,'0')}`}
async function record(id:string,title:string,route:string,run:(api:any)=>Promise<void>){
 if(process.argv[2] && process.argv[2]!==id)return
 const ctx=await browser.newContext({viewport:{width:1440,height:1000},recordVideo:{dir:'/tmp/webtummy-support-raw-video',size:{width:1440,height:1000}}})
 await ctx.addCookies([{name:salt,value:token,domain:'webtummy.com',path:'/',secure:true,httpOnly:true,sameSite:'Lax'}])
 await ctx.route('**/*',async r=>['GET','HEAD'].includes(r.request().method())?r.continue():r.abort())
 const page=await ctx.newPage();page.setDefaultTimeout(15000)
 const video=page.video()!;const cues:Cue[]=[];const start=Date.now()
 const install=async()=>{await page.evaluate(()=>{
 const box=document.createElement('div');box.id='support-caption';box.setAttribute('aria-hidden','true');Object.assign(box.style,{position:'fixed',bottom:'0',left:'0',right:'0',zIndex:'2147483646',background:'#14243Af5',borderTop:'4px solid #6B4EE6',color:'white',padding:'20px 36px',minHeight:'103px',fontFamily:'Arial,sans-serif',pointerEvents:'none',boxShadow:'0 -8px 40px #14243A22'});document.body.append(box)
 const pointer=document.createElement('div');pointer.id='support-pointer';Object.assign(pointer.style,{position:'fixed',width:'25px',height:'25px',border:'3px solid #6B4EE6',borderRadius:'50%',background:'#A995FF55',zIndex:'2147483645',pointerEvents:'none',left:'700px',top:'500px',boxShadow:'0 0 0 5px #fff9'});document.body.append(pointer)
 document.addEventListener('mousemove',e=>{pointer.style.left=`${e.clientX-12}px`;pointer.style.top=`${e.clientY-12}px`})
 })}
 const say=async(text:string,hold=2800)=>{if(!await page.locator('#support-caption').count())await install();await page.evaluate(()=>{const parent=document.querySelector('dialog[open]')??document.body;for(const id of ['support-caption','support-pointer']){const n=document.getElementById(id);if(n&&n.parentElement!==parent)parent.append(n)}});const at=(Date.now()-start)/1000;if(cues.length)cues.at(-1)!.end=at;cues.push({start:at,end:at+hold/1000,text});await page.locator('#support-caption').evaluate((node:any,arg:any)=>{node.innerHTML='';const eyebrow=document.createElement('div');eyebrow.textContent=`WEBTUMMY HELP CENTER  /  ${arg.title}`;Object.assign(eyebrow.style,{fontSize:'10px',fontWeight:'700',letterSpacing:'1.5px',color:'#BBAAFF',marginBottom:'10px'});const p=document.createElement('div');p.textContent=arg.text;Object.assign(p.style,{fontSize:'20px',fontWeight:'500',lineHeight:'1.5'});node.append(eyebrow,p)},{text,title});await page.waitForTimeout(hold)}
 const click=async(locator:any)=>{await locator.scrollIntoViewIfNeeded();const box=await locator.boundingBox();if(box){await page.mouse.move(box.x+box.width/2,box.y+box.height/2,{steps:18});await locator.evaluate((n:HTMLElement)=>{n.style.outline='3px solid #A995FF';n.style.outlineOffset='3px'});await page.waitForTimeout(650)}await locator.click();await page.waitForTimeout(700)}
 try{
 await page.goto(`https://webtummy.com${route}`,{waitUntil:'domcontentloaded'});await page.waitForTimeout(1500);await install();await say(title,2400)
 await run({page,say,click})
 await say('Review your changes, then Save. Publish separately when you are ready to go live.',3500)
 cues.at(-1)!.end=(Date.now()-start)/1000
 await ctx.close();const raw=await video.path();copyFileSync(raw,`${output}/${id}.webm`)
 writeFileSync(`${output}/${id}.vtt`,'WEBVTT\n\n'+cues.map((c,i)=>`${i+1}\n${timestamp(c.start)} --> ${timestamp(c.end)}\n${c.text}\n`).join('\n'))
 results.push({id,title,duration:Math.ceil(cues.at(-1)!.end),captions:cues.map(c=>c.text),normalCustomer:true})
 console.log(`Recorded ${id}: ${Math.ceil(cues.at(-1)!.end)}s`)
 }catch(e){await ctx.close();throw e}
}
try{
 await record('dashboard-tour','Your dashboard and website actions','/dashboard',async({page,say,click}:any)=>{
 await say('This is an ordinary customer workspace. Willow Studio is our fictional demo website.')
 await say('The summary shows your websites, published sites, AI builds, and current package.')
 await page.locator('.wt-site-card').first().scrollIntoViewIfNeeded();await say('Each website card has its own editor, analytics, publishing, test link, and AI actions.',4000)
 await click(page.getByRole('link',{name:'Open editor ↗',exact:true}));await page.locator('[data-awb-section-id]').first().waitFor();
 // Restore the caption and cursor after full navigation.
 await page.evaluate(()=>document.querySelector('#support-caption')?.remove());
 const captionExists=await page.locator('#support-caption').count();if(!captionExists){await page.evaluate(()=>{const n=document.createElement('div');n.id='support-caption';Object.assign(n.style,{position:'fixed',bottom:0,left:0,right:0,zIndex:2147483646,background:'#14243Af5',borderTop:'4px solid #6B4EE6',color:'white',padding:'20px 36px',minHeight:'103px',fontFamily:'Arial,sans-serif',pointerEvents:'none'});document.body.append(n)})}
 await say('The editor has sections on the left, your website in the middle, and Properties on the right.',4000)
 })
 await record('add-page','Add a website page or blog post',`/projects/${projectId}/editor`,async({page,say,click}:any)=>{
 await say('Use + Blog / Page in the top bar to create content inside this website.')
 await click(page.getByRole('button',{name:'+ Blog / Page',exact:true}))
 const dialog=page.getByRole('dialog');await dialog.locator('select').first().selectOption('page');await say('Choose New website page. For a post and blog listing, choose Blog post instead.')
 await dialog.getByLabel('Topic / working title',{exact:true}).fill('Brand design for growing businesses');await say('Enter a clear topic and review the URL slug created from the title.')
 await dialog.getByLabel('Primary keyword',{exact:true}).fill('brand design services')
 await dialog.getByLabel('Target audience',{exact:true}).fill('Small business owners')
 await dialog.getByLabel('Brief and verified facts',{exact:true}).fill('Introduce our brand identity service. Explain the discovery, design, and delivery stages. Invite readers to contact the studio.')
 await say('Provide the audience, keywords, purpose, and verified facts you want the page to use.',4000)
 await dialog.getByLabel('Add an AI-generated page cover',{exact:true}).check();await say('An optional cover needs both a subject description and visual style.')
 await say('Choose Generate content when your brief is ready. This walkthrough stops before submitting an AI job.',4500)
 await click(page.getByRole('button',{name:'Close creation form',exact:true}))
 })
 await record('add-section','Add sections and build without AI',`/projects/${projectId}/editor`,async({page,say,click}:any)=>{
 await say('Choose the page first, then add a section in the left panel.')
 await click(page.getByRole('button',{name:'+ Add section',exact:true}));await say('AI chooses layout creates a section from your topic and instructions.')
 await click(page.getByRole('button',{name:'I choose layout',exact:true}));await say('I choose layout lets you browse component families and choose a starting layout.')
 await click(page.getByRole('button',{name:'+ Blank section — build without AI',exact:true}));await say('A blank section gives you a clean starting point with no AI generation.')
 await click(page.getByRole('button',{name:'+ Add object',exact:true}));await say('Choose a destination section, then one of the 14 available object types.')
 await click(page.getByRole('button',{name:'Heading',exact:true}));await say('Your new heading is selected. Use Properties to edit its text and styling.',4000)
 })
 await record('component-toolbar','Select and style a component',`/projects/${projectId}/editor`,async({page,say,click}:any)=>{
 await say('Click an object to select it. Double-click editable text when you want to type.')
 await click(page.locator('[data-awb-section-id="hero"] h1[data-awb-element]').first())
 const bar=page.getByRole('toolbar',{name:'text controls',exact:true});await say('The toolbar changes with your selection: text, image, button, field, or container.')
 await click(bar.getByRole('button',{name:'Bold',exact:true}));await say('Set a font, size, emphasis, colour, and alignment for the selected text.')
 await click(bar.getByRole('button',{name:'Spacing',exact:true}));await say('Spacing controls adjust padding inside the object and margins around it.')
 await click(bar.getByRole('button',{name:'Borders',exact:true}));await say('Borders controls colour, width, style, and corner radius.')
 await click(bar.getByRole('button',{name:'Move into section…',exact:true}));await say('Move into section chooses a destination. Layers controls stacking when objects overlap.')
 })
 await record('right-properties','Use Section, Page, Theme, and Integrations',`/projects/${projectId}/editor`,async({page,say,click}:any)=>{
 await click(page.getByRole('button',{name:/Section 1 ·/}));await say('Section properties change the selected section’s content, background, and available layout variants.',4000)
 await click(page.getByRole('button',{name:'page',exact:true}));await say('Page properties contain page rewriting, the page title, H1, and search settings.')
 await page.getByLabel('Page title',{exact:true}).scrollIntoViewIfNeeded();await say('Update the SEO title, description, keywords, canonical path, and page indexing.')
 await click(page.getByRole('button',{name:'theme',exact:true}));await say('Theme controls shared design: logo, header appearance, buttons, palette, and typography.')
 await page.getByText('Palette',{exact:true}).scrollIntoViewIfNeeded();await say('Check changes across several pages. An individual object can override theme defaults.')
 await click(page.getByRole('button',{name:'integrations',exact:true}));await say('Integrations includes site indexing, Search Console verification, GA4, reCAPTCHA, and custom scripts.',4000)
 })
 await record('replace-image','Replace, resize, or generate an image',`/projects/${projectId}/editor`,async({page,say,click}:any)=>{
 await click(page.locator('[data-awb-section-id="hero"] img[data-awb-element]').first());const bar=page.getByRole('toolbar',{name:'image controls',exact:true})
 await say('Select the exact image you want to change.')
 await click(bar.getByRole('button',{name:'Size',exact:true}));await say('Use width and height to resize. Fill / crop fills the box; Fit whole image shows the full picture.')
 await click(bar.getByRole('button',{name:'Replace image',exact:true}));await say('Replace image offers a file upload, your project image library, or an image URL.')
 await click(bar.getByRole('button',{name:/Choose from image library/}));await say('Choose an existing project image from the library. These are demo assets, not customer photos.',4000)
 await click(bar.getByRole('button',{name:/Choose from image library|Close image library/}).first()).catch(()=>{})
 await click(bar.getByRole('button',{name:'Update with AI',exact:true}));await say('For an AI replacement, describe what the image should show and choose the visual direction.')
 await say('Generate only when the instructions are ready. This demo does not submit a generation request.',4000)
 })
 const allIds=['dashboard-tour','add-page','add-section','component-toolbar','right-properties','replace-image']
 const all=allIds.filter(id=>existsSync(`${output}/${id}.vtt`)&&existsSync(`${output}/${id}.webm`)).map(id=>({id,captions:readFileSync(`${output}/${id}.vtt`,'utf8').split('\n\n').slice(1).map(c=>c.split('\n').slice(2).join(' ')).filter(Boolean)}))
 writeFileSync(`${output}/manifest.json`,JSON.stringify({recordedAt:new Date().toISOString(),account:'Normal customer; no platform admin or support flags',website:'Fictional Willow Studio demo',videos:all},null,2))
 writeFileSync('apps/web/src/app/support/video-transcripts.json',JSON.stringify({videos:all},null,2))
 console.log(`Completed ${results.length} captioned customer walkthroughs`)
} finally{await browser.close();await prisma.$disconnect()}
