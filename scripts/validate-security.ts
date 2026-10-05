import 'dotenv/config'
import { sameOriginRequest } from '../apps/web/src/lib/request-origin'
import { appUrl } from '../apps/web/src/lib/account-security'
import assert from 'node:assert/strict'
import sharp from 'sharp'
import { normalizeUploadedImage, publicImageAddress, readPublicImage, IMAGE_CONTENT_POLICY, MAX_IMAGE_BYTES } from '@awb/shared'
import { readBoundedBody, RequestBodyTooLarge } from '../apps/web/src/lib/request-body'

async function main() {
  assert.equal(sameOriginRequest(new Request('http://127.0.0.1:3001/api/assets', { headers: { Origin: appUrl() } })), true)
  assert.equal(sameOriginRequest(new Request('http://127.0.0.1:3001/api/assets', { headers: { Origin: 'https://security-test.invalid' } })), false)
  assert.equal(sameOriginRequest(new Request('http://127.0.0.1:3001/api/assets', { headers: { Origin: 'null' } })), false)
  for (const address of ['127.0.0.1','10.0.0.1','169.254.169.254','172.16.0.1','192.168.1.1','100.64.0.1','0.0.0.0','224.0.0.1','::1','::ffff:127.0.0.1','fe80::1','fc00::1','2001:db8::1']) assert.equal(publicImageAddress(address),false,address)
  assert.equal(publicImageAddress('8.8.8.8'),true)
  assert.equal(publicImageAddress('2606:4700:4700::1111'),true)
  for (const url of ['http://127.0.0.1/a.svg','http://2130706433/a.png','http://[::1]/a.png','http://[::ffff:127.0.0.1]/a.png','http://169.254.169.254/a.png','file:///etc/passwd','https://user:pass@webtummy.com/a.png','http://webtummy.com:5433/a.png']) await assert.rejects(readPublicImage(url),undefined,url)
  assert.equal(MAX_IMAGE_BYTES, 5 * 1024 * 1024)
  await assert.rejects(normalizeUploadedImage(Buffer.alloc(MAX_IMAGE_BYTES + 1)))
  const svg=Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><rect width="20" height="20" fill="#de3871"/><script>window.securityCanary=true</script></svg>')
  const png=await normalizeUploadedImage(svg)
  assert.equal((await sharp(png).metadata()).format,'png')
  assert.equal(png.includes(Buffer.from('securityCanary')),false)
  await assert.rejects(normalizeUploadedImage(Buffer.from('<html>not an image</html>')))
  await assert.rejects(normalizeUploadedImage(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10000" height="10000"/>')))
  assert.ok(IMAGE_CONTENT_POLICY.includes("default-src 'none'"))
  assert.ok(IMAGE_CONTENT_POLICY.startsWith('sandbox;'))
  assert.deepEqual(await readBoundedBody(new Request('https://test.invalid',{method:'POST',body:'safe'}),4),new TextEncoder().encode('safe'))
  await assert.rejects(readBoundedBody(new Request('https://test.invalid',{method:'POST',body:'oversized'}),4),RequestBodyTooLarge)
  const stream=new ReadableStream({start(controller){controller.enqueue(new Uint8Array(3));controller.enqueue(new Uint8Array(3));controller.close()}})
  await assert.rejects(readBoundedBody(new Request('https://test.invalid',{method:'POST',body:stream,duplex:'half'} as RequestInit),4),RequestBodyTooLarge)
  console.log('PASS: private/encoded IPs blocked, executable SVG rasterized, invalid/oversized images rejected, bounded streams enforced.')
}
main().catch(error=>{console.error(error);process.exitCode=1})
