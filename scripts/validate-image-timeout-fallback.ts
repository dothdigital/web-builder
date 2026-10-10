import assert from 'node:assert/strict'
import {OpenAiProvider} from '@awb/ai'
const originalFetch=globalThis.fetch
let calls=0
async function main(){
 globalThis.fetch=async()=>{
  calls++
  if(calls===1) throw new DOMException('Request timed out','TimeoutError')
  return new Response(JSON.stringify({data:[{b64_json:Buffer.from('fixture-image').toString('base64')}]}),{status:200})
 }
 try{
  const provider=new OpenAiProvider({apiKey:'test-fixture',modelOverrides:{image_generate:{model:'first-model',fallbacks:['second-model']}}})
  const result=await provider.generateImage('Fixture prompt','16:9','slot','Fixture alt')
  assert.equal(calls,2)
  assert.equal(result.usage.model,'second-model')
  assert.equal(result.data.data.toString(),'fixture-image')
  console.log('PASS: image timeout falls back to the next configured model without external calls')
 }finally{globalThis.fetch=originalFetch}
}
void main()
