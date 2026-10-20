import assert from 'node:assert/strict'
import {getComponent,defaultTokens} from '@awb/component-registry'
import type {WebsiteModel} from '@awb/website-model'
import {reviewEditorContent,isReviewImagePointer} from '../apps/web/src/lib/editor-content-review'
const header=getComponent('HeaderSplitUtility')!,footer=getComponent('FooterCompact')!
const model={tokens:defaultTokens,contact:{hours:[]},socials:[],navigation:{primaryMenu:[]},globalComponents:{header:{componentId:header.componentId,props:{...header.fixture as object,logoImageUrl:'/logo.png'}},footer:{componentId:footer.componentId,props:footer.fixture}},pages:[{id:'about',path:'/about',title:'About',seo:{description:'About'},sections:[{id:'hero',componentId:'HeroEditorial',props:{heading:'About',imageUrl:'/photo.png'}},{id:'philosophy',componentId:'AboutSplitOverlap',props:{heading:'Our philosophy',body:'',sectionBackgroundMode:'colour',sectionBackgroundImageUrl:''}}]},{id:'home',path:'/',title:'Home',seo:{description:'Home'},sections:[{id:'services',componentId:'ServicesLargeNumbers',props:{heading:'Services',items:[{title:'About',href:'/about',imageUrl:''}]}}]}]} as unknown as WebsiteModel
const page=model.pages.find((p:any)=>p.path==='/about')
const section=page.sections.find((s:any)=>s.id==='philosophy')
delete section!.props.imageUrl
section.props.body=''
section.props.sectionBackgroundMode='colour'
section.props.sectionBackgroundImageUrl=''
const before=JSON.stringify(model)
const fields=reviewEditorContent(model)
assert.equal(JSON.stringify(model),before,'Review must never change draft content')
const image=fields.find(f=>f.pageId===page.id&&f.sectionId===section.id&&f.pointer==='/imageUrl')!
assert.ok(fields.some(f=>f.pageId==='home'&&f.pointer==='/items/0/imageUrl'&&f.value==='/photo.png'&&!f.empty),'Linked page imagery is not incorrectly flagged as missing')
assert.equal(image.kind,'image');assert.ok(image.empty,'Absent optional image is actionable')
assert.ok(fields.some(f=>f.pageId===page.id&&f.sectionId===section.id&&f.pointer==='/body'&&f.empty))
assert.ok(!fields.some(f=>f.pointer==='/sectionBackgroundImageUrl'),'Inactive decorative backgrounds excluded')
assert.ok(fields.some(f=>f.globalSlot==='header'&&f.pointer==='/logoImageUrl'))
section.hidden=true
assert.ok(!reviewEditorContent(model).some(f=>f.sectionId===section.id&&f.pageId===page.id))
section.hidden=false;section.props.removedElements=['/imageUrl']
assert.ok(!reviewEditorContent(model).some(f=>f.sectionId===section.id&&f.pageId===page.id&&f.pointer==='/imageUrl'))
assert.ok(isReviewImagePointer('/imageUrl'));assert.ok(isReviewImagePointer('/images/2/url'));assert.ok(!isReviewImagePointer('/heading'))
model.pages[0]!.sections.push({id:'gallery',componentId:'GalleryAsymmetric',componentVersion:'1.0.0',props:{images:[{alt:'Not chosen'}]}} as any)
assert.ok(reviewEditorContent(model).some(f=>f.sectionId==='gallery'&&f.pointer==='/images/0/url'&&f.empty),'Absent gallery URL is actionable')
const manual=getComponent('ManualSection')!
model.pages[0]!.sections.push({id:'manual',componentId:manual.componentId,componentVersion:manual.version,props:manual.propsSchema.parse({items:[{id:'text',kind:'text',text:'Only text'},{id:'space',kind:'spacer'}]})} as any)
assert.ok(!reviewEditorContent(model).some(f=>f.sectionId==='manual'&&f.kind==='image'),'Manual text/spacer defaults are not missing image positions')
console.log('PASS: all-page review finds absent images and empty content, includes shared header images, excludes hidden/removed fields and inactive backgrounds, and never mutates the draft.')
