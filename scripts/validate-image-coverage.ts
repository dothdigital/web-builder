import assert from 'node:assert/strict'
import {collectImageSlots} from '../packages/pipeline/src/run'
import {resolveSectionMedia} from '../apps/web/src/lib/section-media'
import type {WebsiteModel} from '@awb/website-model'
const imageSection=(id:string,url='')=>({id,componentId:'Tpl_webtummy-business_12_2',componentVersion:'1.0.0',hidden:false,props:{imageUrl:url,image1:'/uploads/secondary.png'}})
const model={pages:[{id:'home',path:'/',title:'Home',sections:[imageSection('hero','/uploads/hero.png'),...Array.from({length:15},(_,i)=>imageSection(`content-${i}`))]},{id:'about',path:'/about',title:'About',sections:[imageSection('about-image')]}]} as unknown as WebsiteModel
const slots=collectImageSlots(model)
assert.equal(slots.length,16,'Coverage must include more than ten slots')
assert.ok(slots.some(slot=>slot.pageTitle==='About'),'Inner-page images must be covered')
assert.equal(resolveSectionMedia(model,model.pages[0]!,model.pages[0]!.sections[1]!).imageUrl,'','Never silently repeat the page hero in an empty content slot')
model.pages[0]!.sections[2]!.hidden=true
assert.equal(collectImageSlots(model).length,15,'Hidden sections must not consume image generation')
const serviceSection={id:'services',componentId:'ServicesLargeNumbers',componentVersion:'1.0.0',hidden:false,props:{items:[{title:'Life insurance',description:'Service facts'}]}}
model.pages[1]!.sections.push(serviceSection)
assert.ok(collectImageSlots(model).some(slot=>slot.slot.endsWith('/items/0/imageUrl')),'Native service cards need their own image slots')
console.log('PASS: all visible image slots, inner-page coverage, and no unrelated hero fallback')
