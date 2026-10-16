import {chromium} from '/tmp/webtummy-ui-check/node_modules/playwright/index.mjs'
import {spawn} from 'node:child_process'
import {once} from 'node:events'
import {mkdirSync,writeFileSync} from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
const dir=path.dirname(fileURLToPath(import.meta.url));const out=path.dirname(dir);const ff='/tmp/webtummy-video-tools/ffmpeg';
const preview=process.argv.includes('--preview');const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage'],env:{...process.env,LD_LIBRARY_PATH:'/tmp/webtummy-browser-libs/root/usr/lib/x86_64-linux-gnu'}})
try{
 const page=await browser.newPage({viewport:{width:1080,height:1920},deviceScaleFactor:1});page.on('pageerror',e=>console.error(e));
 await page.goto('file://'+dir+'/ad.html');await page.evaluate(()=>window.ready);
 if(preview){
  mkdirSync(out+'/previews',{recursive:true});
  for(const [i,t]of [1.8,4.6,8.7,11.8,14.8,18.8].entries()){await page.evaluate(t=>window.render(t),t);await page.screenshot({path:`${out}/previews/scene-${i+1}.png`})}
  console.log('Six scene previews saved.');
 }else{
  for(const [name,height]of [['reels-stories-1080x1920',1920],['feed-1080x1350',1350]]){
   await page.setViewportSize({width:1080,height});
   const target=`${out}/webtummy-ad-${name}.mp4`;
   const args=['-y','-hide_banner','-loglevel','error','-f','image2pipe','-framerate','30','-vcodec','mjpeg','-i','pipe:0','-i',dir+'/soundtrack.wav','-map','0:v','-map','1:a','-c:v','libx264','-preset','fast','-crf','18','-pix_fmt','yuv420p','-r','30','-c:a','aac','-b:a','192k','-af','loudnorm=I=-16:TP=-1.5:LRA=9','-ar','48000','-t','20','-movflags','+faststart','-threads','2',target];
   const encoder=spawn(ff,args,{stdio:['pipe','inherit','inherit']});let error;encoder.on('error',e=>error=e);const completed=once(encoder,'close');
   for(let frame=0;frame<600;frame++){
    await page.evaluate(({t,h})=>window.render(t,h),{t:frame/30,h:height});
    const buf=await page.screenshot({type:'jpeg',quality:95,animations:'disabled'});
    if(!encoder.stdin.write(buf))await once(encoder.stdin,'drain');
    if(frame%150===0)console.log(name,`${Math.round(frame/6)}%`);
   }
   encoder.stdin.end();const[code]=await completed;if(code!==0||error)throw error||new Error('Encoder exit '+code);
   await page.evaluate(h=>window.render(18.8,h),height);await page.screenshot({path:target.replace('.mp4','-poster.jpg'),type:'jpeg',quality:96});
   console.log('Completed '+target);
  }
 }
}finally{await browser.close()}
