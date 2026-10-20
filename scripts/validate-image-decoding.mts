import assert from 'node:assert/strict'
import sharp from 'sharp'
import {exportImage} from '../apps/web/src/lib/export-image'
await assert.rejects(()=>exportImage(Buffer.from('not an image'),'small.png'))
const bytes=await sharp({create:{width:2,height:2,channels:4,background:'#123456'}}).png().toBuffer()
const result=await exportImage(bytes,'small.png')
assert.deepEqual(result.bytes,bytes)
assert.equal(result.name,'small.png')
console.log('PASS: corrupt small images rejected; valid small images preserved')
