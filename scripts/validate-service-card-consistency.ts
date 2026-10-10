import assert from 'node:assert/strict'
import type{WebsiteModel}from '@awb/website-model'
import{alignTemplateServiceCards,templateImageSubject,emptyImagePointers}from '@awb/component-registry'
const model={pages:[{id:'home',path:'/',sections:[{id:'services',componentId:'Tpl_webtummy-business_10_2',props:{text2:'Physiotherapy',text5:'Massage Therapy',text8:'Injury Rehabilitation',imageUrl:'physio',image1:'massage',image2:'rehab'}}]},{id:'about',path:'/about',sections:[{id:'services',componentId:'Tpl_webtummy-business_about_3',props:{text2:'Physiotherapy',text5:'Massage Therapy',text8:'Rehabilitation Care',image1:'old-physio',image2:'old-rehab',image3:'old-massage'}}]},...['Physiotherapy','Massage Therapy','Rehabilitation'].map(title=>({title,navLabel:title,path:'/services/'+title.toLowerCase().replaceAll(' ','-'),sections:[]}))]}as unknown as WebsiteModel
const fixed=alignTemplateServiceCards(model,{reuseHomeImages:true,replaceableImages:new Set(['old-physio','old-rehab','old-massage'])})
assert.equal(fixed.pages[0]!.sections[0]!.props.text8,'Rehabilitation')
assert.equal(fixed.pages[1]!.sections[0]!.props.image2,'massage')
assert.equal(fixed.pages[1]!.sections[0]!.props.image3,'rehab')
assert.equal(model.pages[1]!.sections[0]!.props.image2,'old-rehab','Do not mutate saved source')
assert.deepEqual(alignTemplateServiceCards(fixed,{reuseHomeImages:true}),fixed,'Repair is idempotent')
assert.equal(alignTemplateServiceCards(model,{reuseHomeImages:true,replaceableImages:new Set()}).pages[1]!.sections[0]!.props.image2,'old-rehab','Preserve uploaded photos')
assert.match(templateImageSubject('Tpl_webtummy-business_about_3','/image2',model.pages[1]!.sections[0]!.props)!,/Massage Therapy/)
assert.deepEqual(emptyImagePointers('Tpl_webtummy-business_10_1',{}),['/image1'],'Hero needs one photograph, not decorative layers')
assert.deepEqual(emptyImagePointers('Tpl_webtummy-business_about_3',{}),['/image1','/image2','/image3'],'Service cards need images, decorative backdrops do not')
console.log('PASS: service naming, relevant imagery, uploaded-photo preservation and required photo roles')
