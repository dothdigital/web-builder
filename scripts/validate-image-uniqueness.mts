import assert from 'node:assert/strict'
import {config} from 'dotenv'
config({path:'.env',quiet:true})
import {websiteModelSchema,repeatedPageImages,assertDistinctPageImages,validateWebsiteModel} from '@awb/website-model'
const {prisma}=await import('@awb/database')
try{
 const seed=await prisma.websiteVersion.findFirstOrThrow({where:{kind:'DRAFT'},orderBy:{createdAt:'asc'}})
 const model=websiteModelSchema.parse(seed.model)
 model.pages=[{id:'p',path:'/',title:'Home',h1:'Home',seo:{title:'Home',description:'Home',index:false},pageType:'CUSTOM',sections:[
 {id:'hero',componentId:'HeroEditorial',componentVersion:'1.0.0',hidden:false,props:{imageUrl:'/photo.png?signature=one'}},
 {id:'about',componentId:'AboutSplitOverlap',componentVersion:'1.0.0',hidden:false,props:{imageUrl:'/photo.png?signature=two'}},
 {id:'hidden',componentId:'AboutSplitOverlap',componentVersion:'1.0.0',hidden:true,props:{imageUrl:'/photo.png'}},
 {id:'removed',componentId:'AboutSplitOverlap',componentVersion:'1.0.0',hidden:false,props:{imageUrl:'/photo.png',removedElements:['/imageUrl']}},
 {id:'manual',componentId:'ManualSection',componentVersion:'1.0.0',hidden:false,props:{items:[{kind:'text',imageUrl:'/photo.png'},{kind:'image',imageUrl:'/different.png'}]}},
 ]}]
 assert.equal(repeatedPageImages(model).length,1)
 assert.equal(repeatedPageImages(model)[0]!.uses.length,2)
 assert.throws(()=>assertDistinctPageImages(model),/Repeated content images/)
 assert.doesNotThrow(()=>assertDistinctPageImages(model,model))
 assert.ok(validateWebsiteModel(model).issues.some(issue=>issue.code==='repeated-page-image'))
 const fixed=structuredClone(model);fixed.pages[0]!.sections[1]!.props.imageUrl='/section-specific.png'
 assert.doesNotThrow(()=>assertDistinctPageImages(fixed))
 const template=structuredClone(fixed);template.pages[0]!.sections[1]!.props={image1:'/photo.png',image2:'/different.png'};assert.equal(repeatedPageImages(template).length,2)
 fixed.pages[0]!.sections.push({id:'new',componentId:'AboutSplitOverlap',componentVersion:'1.0.0',hidden:false,props:{imageUrl:'/photo.png'}})
 assert.throws(()=>assertDistinctPageImages(fixed,model),/Repeated content images/)
 console.log('PASS: signed URLs, duplicate detection, hidden/removed/inactive exclusion, strict generation guard, scoped baseline preservation, distinct replacement and validation warnings.')
}finally{await prisma.$disconnect()}
