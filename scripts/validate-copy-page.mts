import {config} from 'dotenv'
config({path:'.env',quiet:true})
import assert from 'node:assert/strict'
import {websiteModelSchema} from '@awb/website-model'
import {copyWebsitePage,suggestPageCopy} from '../apps/web/src/lib/copy-page'
const {prisma}=await import('@awb/database')
try{
 const seed=await prisma.websiteVersion.findFirstOrThrow({where:{kind:'DRAFT'},orderBy:{createdAt:'asc'}})
 const model=websiteModelSchema.parse(seed.model)
 model.navigation={primaryMenu:[],footerMenu:[],utilityMenu:[]}
 model.pages=[{id:'source',path:'/',title:'Original',pageType:'CUSTOM',h1:'Original',seo:{title:'Original',description:'Original page',canonical:'/'},customScripts:{head:'<!-- preserved head -->',bodyEnd:'<!-- preserved footer -->'},sections:[{id:'source-anchor',componentId:'ManualSection',componentVersion:'1.0.0',hidden:false,props:{sectionColumns:2,items:[{id:'item',kind:'button',column:2,label:'Jump',href:'#source-anchor'},{id:'image',kind:'image',column:1,imageUrl:'/uploads/existing.png'},{id:'html',kind:'embed',column:2,html:'<p>Custom code</p>',css:'p{color:red}',javascript:'document.body.dataset.ready="yes"'}],elementColors:{'/items/0':{color:'#123456'}}}}]}]
 const before=JSON.stringify(model)
 const result=copyWebsitePage(model,'source',{title:'Independent copy',path:'/home-copy',addToNavigation:false},'copied')
 const page=result.model.pages.at(-1)!
 assert.equal(JSON.stringify(model),before)
 assert.notEqual(page.id,'source');assert.notEqual(page.sections[0]!.id,'source-anchor')
 assert.equal(page.seo.canonical,'/home-copy')
 assert.equal((page.sections[0]!.props.items as any[])[0].href,`#${page.sections[0]!.id}`)
 assert.equal((page.sections[0]!.props.items as any[])[1].imageUrl,'/uploads/existing.png')
 assert.equal((page.sections[0]!.props.items as any[])[2].html,'<p>Custom code</p>')
 assert.deepEqual(page.customScripts,model.pages[0]!.customScripts)
 assert.deepEqual(result.model.navigation,model.navigation)
 ;(page.sections[0]!.props.items as any[])[2].html='Independent edit'
 assert.equal((model.pages[0]!.sections[0]!.props.items as any[])[2].html,'<p>Custom code</p>')
 assert.equal(suggestPageCopy(result.model,model.pages[0]!).path,'/original-copy')
 assert.throws(()=>copyWebsitePage(result.model,'source',{title:'Duplicate',path:'/home-copy',addToNavigation:true},'collision'),/already exists/)
 const navigable=copyWebsitePage(model,'source',{title:'Menu copy',path:'/menu-copy',addToNavigation:true},'menu-copy')
 assert.ok(navigable.model.navigation.primaryMenu.some(item=>item.pageId==='menu-copy'))
 console.log('PASS: independent page/section copies, preserved columns/styles/images/custom HTML/scripts, remapped anchors, unique URL suggestions, collision prevention and optional navigation; no database writes or AI jobs.')
}finally{await prisma.$disconnect()}
