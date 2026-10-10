import assert from 'node:assert/strict'
import React from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
import {JSDOM} from 'jsdom'
import {generationOptionsSchema,imageDirectionPrompt,contentDirectionPrompt} from '@awb/shared'
import {ImageDirectionFields} from '../apps/web/src/components/image-direction-fields'
import {ContentDirectionFields} from '../apps/web/src/components/content-direction-fields'
Object.assign(globalThis,{React})
assert.equal(generationOptionsSchema.parse({}).mode,'full','Legacy jobs keep full generation')
for(const mode of ['full','content','images','content-images','fill-images']) assert.equal(generationOptionsSchema.parse({mode}).mode,mode)
assert.equal(generationOptionsSchema.safeParse({mode:'invalid'}).success,false)
assert.equal(generationOptionsSchema.safeParse({imageDirection:{notes:'x'.repeat(1501)}}).success,false)
const options=generationOptionsSchema.parse({mode:'content-images',imageDirection:{style:'combination',notes:'Canadian families'},contentDirection:{style:'educational',audience:'First-time buyers',notes:'Plain language'}})
assert.match(imageDirectionPrompt(options.imageDirection,'Toronto'),/Toronto/)
assert.match(imageDirectionPrompt(options.imageDirection,'Toronto'),/Canadian families/)
assert.match(contentDirectionPrompt(options.contentDirection),/First-time buyers/)
assert.match(contentDirectionPrompt(options.contentDirection),/Plain language/)
const doc=new JSDOM(renderToStaticMarkup(<><ImageDirectionFields value={options.imageDirection} onChange={()=>{}}/><ContentDirectionFields value={options.contentDirection} onChange={()=>{}}/></>)).window.document
assert.equal(doc.querySelectorAll('select').length,0)
assert.equal(doc.querySelectorAll('input[type="checkbox"][checked]').length,3)
const combined=generationOptionsSchema.parse({imageDirection:{styles:['people','local','industry']},contentDirection:{styles:['professional','educational']}})
assert.match(imageDirectionPrompt(combined.imageDirection,'Toronto'),/people.*local.*industry/i)
assert.match(contentDirectionPrompt(combined.contentDirection),/professional.*educational/i)
assert.equal(doc.querySelector('input:not([type="checkbox"])')?.getAttribute('value'),'First-time buyers')
console.log('PASS: image/content intake controls, job defaults, rerun modes and prompt preferences')
