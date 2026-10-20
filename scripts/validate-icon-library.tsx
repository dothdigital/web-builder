import React from 'react'
import assert from 'node:assert/strict'
import { renderToStaticMarkup } from 'react-dom/server'
import sharp from 'sharp'
import { Media } from '@awb/component-registry'
import { iconImage, type LibraryIcon } from '../apps/web/src/lib/icon-image'
import { readFileSync } from 'node:fs'
const icons=JSON.parse(readFileSync('apps/web/public/icon-library/lucide-1.59.0.json','utf8')) as Record<string,LibraryIcon>
import { assertBundledPageImages } from '../apps/web/src/lib/static-export'
Object.assign(globalThis,{React})
async function main() {
for (const name of ['heart','phone','check']) {
 const uri=iconImage((icons as Record<string,LibraryIcon>)[name]!, '#336699', 80)
 const svg=decodeURIComponent(uri.split(',')[1]!)
 assert.ok(svg.includes('Copyright (c) 2026 Lucide Icons and Contributors'))
 assert.ok(svg.includes('Permission to use, copy, modify'))
 const metadata=await sharp(Buffer.from(svg)).metadata()
 assert.equal(metadata.width,80);assert.equal(metadata.height,80)
 await sharp(Buffer.from(svg)).png().toBuffer()
 const html=renderToStaticMarkup(<Media src={uri} alt={`${name} icon`} />)
 assert.match(html, /(?:style="|;)width:80px(?:;|")/); assert.match(html, /(?:style="|;)height:80px(?:;|")/)
 assert.ok(html.includes('object-fit:contain'))
 assertBundledPageImages(html,'index.html',()=>false)
}
assert.throws(()=>iconImage((icons as any).heart,'bad',64))
assert.throws(()=>iconImage((icons as any).heart,'#000000',999))
assert.ok(Object.keys(icons).length>1800)
console.log('PASS: local icon library, licensed self-contained SVGs, color/size validation, real SVG decoding, intrinsic icon dimensions and standalone export image validation.')

}
main().catch(error=>{console.error(error);process.exitCode=1})
