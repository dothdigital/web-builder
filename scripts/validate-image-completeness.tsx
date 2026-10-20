import React from 'react'
import assert from 'node:assert/strict'
import {renderToStaticMarkup} from 'react-dom/server'
import {getComponent,defaultTokens} from '@awb/component-registry'
import {Media} from '../packages/component-registry/src/primitives'
import {assertBundledPageImages,ExportAssetError} from '../apps/web/src/lib/static-export'
Object.assign(globalThis,{React})
const render=(id:string,props:Record<string,unknown>,editing=false)=>{const d=getComponent(id)!;return renderToStaticMarkup(React.createElement(d.render,{props:d.propsSchema.parse(props),context:{tokens:defaultTokens,baseUrl:'',editing}}))}
for(const src of [undefined,'','   '])assert.equal(renderToStaticMarkup(<Media src={src} alt="Empty"/>),'')
assert.match(renderToStaticMarkup(<Media editing alt="Empty"/>),/data-awb-image-placeholder/)
const about={heading:'Our approach',body:'Real content',points:[],stats:[]}
const emptyAbout=render('AboutSplitOverlap',about)
assert.ok(emptyAbout.includes('grid-template-columns:1fr'))
assert.ok(!emptyAbout.includes('Image placeholder')&&!emptyAbout.includes('box-shadow:0 18px'))
assert.match(render('AboutSplitOverlap',about,true),/Image placeholder/)
assert.match(render('AboutSplitOverlap',{...about,imageUrl:'/photo.png'}),/<img/)
assert.equal(render('GalleryAsymmetric',{images:[{alt:'Empty'}]}),'')
assert.match(render('GalleryAsymmetric',{images:[{alt:'Empty'}]},true),/Image placeholder/)
const gallery=render('GalleryAsymmetric',{images:[{alt:'Empty'},{url:'/photo.png',alt:'Photo'}]})
assert.equal((gallery.match(/<img/g)||[]).length,1)
assert.ok(gallery.includes('/images/1/url'),'Editing pointers survive filtering')
for(const id of ['ServicesImageRail','ServicesAlternatingShowcase']){
 const html=render(id,{heading:'Services',items:[{title:'Service',description:'Content'}]})
 assert.ok(!html.includes('Image placeholder'))
 if(id==='ServicesAlternatingShowcase')assert.ok(html.includes('grid-template-columns:1fr'))
}
const exists=(p:string)=>p==='assets/photo.webp'
assertBundledPageImages('<img src="../../assets/photo.webp">','services/detail/index.html',exists)
assertBundledPageImages('<img src="data:image/png;base64,abc">','index.html',exists)
for(const src of ['', '../missing.webp','https://private.example/image','//example/image','/not-bundled.png'])assert.throws(()=>assertBundledPageImages(`<img src="${src}">`,'about/index.html',exists),ExportAssetError)
assert.throws(()=>assertBundledPageImages('<div data-awb-image-placeholder="true"></div>','index.html',exists),ExportAssetError)
console.log('PASS: optional media collapses, editor placeholders remain, galleries preserve editing pointers, present images render, nested image paths resolve, and unbundled images block release creation.')
