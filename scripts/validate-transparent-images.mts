import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import sharp from 'sharp'
import {OpenAiProvider} from '../packages/ai/src/openai'
import {blogCoverRequestSchema,blogCoverPrompt} from '../packages/pipeline/src/content-creation'
import {assertTransparentImage} from '../packages/shared/src/image-transparency'
import {exportImage} from '../apps/web/src/lib/export-image'
const input={purpose:'website',topic:'An isolated flower illustration',direction:'Clean cutout',requestId:randomUUID()}
assert.equal(blogCoverRequestSchema.parse(input).background,'auto')
assert.equal(blogCoverRequestSchema.parse({...input,background:'transparent'}).background,'transparent')
assert.match(blogCoverPrompt({...input,background:'transparent'}),/fully transparent background/)
const rgba=Buffer.alloc(32*32*4);for(let i=0;i<32*32;i++){rgba[i*4]=40;rgba[i*4+1]=110;rgba[i*4+2]=170;rgba[i*4+3]=i<512?0:255}
const png=await sharp(rgba,{raw:{width:32,height:32,channels:4}}).png().toBuffer()
await assertTransparentImage(png)
const opaque=await sharp({create:{width:32,height:32,channels:4,background:'#ffffff'}}).png().toBuffer()
const empty=await sharp({create:{width:32,height:32,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).png().toBuffer()
await assert.rejects(assertTransparentImage(opaque),/transparent/)
await assert.rejects(assertTransparentImage(empty),/visible subject/)
await assert.rejects(assertTransparentImage(await sharp(png).jpeg().toBuffer()),/PNG transparency/)
const exported=await exportImage(png,'transparent.png');await assertTransparentImage(exported.bytes)
const originalFetch=globalThis.fetch,calls:any[]=[]
try{
 globalThis.fetch=async (_url,init)=>{const body=JSON.parse(init!.body as string);calls.push(body);if(calls.length===1)return new Response('Unavailable',{status:400});return Response.json({data:[{b64_json:png.toString('base64')}]})}
 const provider=new OpenAiProvider({apiKey:'isolated-test-no-real-api-call',modelOverrides:{image_generate:{model:'primary',fallbacks:['fallback']}}})
 const result=await provider.generateImage('Test cutout','16:9','editor:image','Cutout',{background:'transparent'})
 assert.equal(calls.length,2)
 assert.ok(calls.every(body=>body.background==='transparent'&&body.output_format==='png'))
 assert.equal(result.data.contentType,'image/png');await assertTransparentImage(result.data.data)
 calls.length=0
 // The same mock returns its fallback response; ordinary generation keeps its current request settings.
 await provider.generateImage('Normal photo','16:9','editor:image','Photo')
 assert.ok(calls.every(body=>body.background===undefined&&body.output_format===undefined))
}finally{globalThis.fetch=originalFetch}
console.log('PASS: transparent request schema/prompt, PNG settings retained through provider fallback, real alpha validation, opaque/empty rejection, and PNG export preservation; no live AI calls.')
