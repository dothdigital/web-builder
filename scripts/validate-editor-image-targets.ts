import assert from 'node:assert/strict'
import { applyEditorImage } from '../apps/web/src/lib/editor-image-update'
import { editorImageTargetSchema } from '@awb/shared/image-direction'
import type { WebsiteModel } from '@awb/website-model'
const model={pages:[{id:'home',sections:[{id:'intro',props:{heading:'Keep this text',imageUrl:'/portrait.png',imageAlt:'Owner',freeElements:[{content:{imageUrl:'/moved.png',imageAlt:'Moved'},width:40,height:500}]}},{id:'service',props:{imageUrl:'/service.png'}}]},{id:'about',sections:[{id:'about-intro',props:{imageUrl:'/about.png'}}]}],globalComponents:{header:{props:{logoImageUrl:'/logo.png'}},footer:{props:{}}}} as unknown as WebsiteModel
const target={pageId:'home',sectionId:'intro',pointer:'/freeElements/0/content/imageUrl',originalUrl:'/moved.png'}
const next=applyEditorImage(model,target,{url:'/generated.png',alt:'New image'})
assert.equal((next.pages[0]!.sections[0]!.props.freeElements as any)[0].content.imageUrl,'/generated.png')
assert.equal((next.pages[0]!.sections[0]!.props.freeElements as any)[0].content.imageAlt,'New image')
assert.equal((next.pages[0]!.sections[0]!.props.freeElements as any)[0].height,500)
assert.equal(next.pages[0]!.sections[0]!.props.heading,'Keep this text')
assert.deepEqual(next.pages[1],model.pages[1]);assert.deepEqual(next.pages[0]!.sections[1],model.pages[0]!.sections[1])
assert.equal((model.pages[0]!.sections[0]!.props.freeElements as any)[0].content.imageUrl,'/moved.png','Source is immutable')
assert.equal(applyEditorImage(next,target,{url:'/generated.png',alt:'New image'}),next,'Repeated completion is idempotent')
assert.throws(()=>applyEditorImage(next,target,{url:'/different.png',alt:'Later'}),/changed while AI/)
assert.throws(()=>applyEditorImage(model,{...target,sectionId:'deleted'},{url:'/new.png',alt:''}),/destination was removed/)
assert.equal(editorImageTargetSchema.safeParse({...target,pointer:'/heading'}).success,false)
assert.equal(editorImageTargetSchema.safeParse({...target,globalSlot:'header'}).success,false)
const header=applyEditorImage(model,{pageId:'home',globalSlot:'header',pointer:'/logoImageUrl',originalUrl:'/logo.png'},{url:'/new-logo.png',alt:''})
assert.equal(header.globalComponents.header.props.logoImageUrl,'/new-logo.png')
console.log('PASS: original destination survives selection changes; moved image URL/alt update together; geometry and other images stay intact; repeated results are safe; manual replacements and deleted destinations are protected.')
