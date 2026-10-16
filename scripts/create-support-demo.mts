import { config } from 'dotenv'
config({path:'.env',quiet:true})
import { mkdirSync, copyFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { localUploadRoot } from '@awb/shared'
import { getComponent, defaultTokens } from '@awb/component-registry'
import { websiteModelSchema } from '@awb/website-model'
const { prisma }=await import('@awb/database')
const marker='help-center-demo-20261015'
const fixtureFile='/tmp/webtummy-support-demo.json'
try {
 const existing=await prisma.workspace.findUnique({where:{slug:marker},include:{members:{include:{user:true}},projects:true}})
 if(existing){writeFileSync(fixtureFile,JSON.stringify({projectId:existing.projects[0].id,userId:existing.members[0].userId,workspaceId:existing.id},null,2),{mode:0o600});console.log('Existing normal-customer demo fixture ready');process.exitCode=0}
 else {
 const assets=[['office.jpg','about/01.jpg'],['team.jpg','about/02.jpg'],['studio.jpg','about/03.jpg']] as const
 const uploadRoot=localUploadRoot();mkdirSync(path.join(uploadRoot,'support-demo'),{recursive:true})
 for(const [file,source]of assets)copyFileSync(`apps/web/public/template-library/finbiz/assets/images/${source}`,path.join(uploadRoot,'support-demo',file))
 const photo='/uploads/support-demo/office.jpg'
 const section=(id:string,componentId:string,props:Record<string,unknown>={})=>{const c=getComponent(componentId)!;return{id,componentId,componentVersion:c.version,props:{...structuredClone(c.fixture) as object,...props}}}
 const pages=[
 {id:'home',path:'/',title:'Home',h1:'Good ideas deserve great design.',seo:{title:'Willow Studio | Creative design',description:'A fictional creative studio used for Webtummy help guides.'},sections:[
 section('hero','HeroEditorial',{eyebrow:'WILLOW STUDIO · DEMO WEBSITE',heading:'Good ideas deserve great design.',body:'We help ambitious teams bring their next idea to life with thoughtful websites, clear content, and a consistent brand.',imageUrl:photo,imageAlt:'A creative team discussing a project',primaryCta:{label:'Start a project',href:'/contact'},secondaryCta:{label:'Explore our services',href:'/services'}}),
 section('about','AboutSplitOverlap',{heading:'A small studio. A clear vision.',body:'This is a fictional website for learning the Webtummy editor. Explore the tools and make every detail your own.',imageUrl:'/uploads/support-demo/team.jpg',imageAlt:'Colleagues working together'}),
 section('services','ServicesLargeNumbers',{heading:'Made for your next chapter.',items:[{title:'Brand design',body:'Build a distinctive visual identity.',href:'/services'},{title:'Website design',body:'Bring your business online with a thoughtful website.',href:'/services'},{title:'Content strategy',body:'Tell a clear and consistent story.',href:'/services'}]}),
 section('faq','FaqAccordion',{heading:'A few helpful answers',items:[{question:'Is this a real business?',answer:'No. Willow Studio is a fictional demo website for Webtummy support guides.'},{question:'Can I use these editing tools?',answer:'Yes. The same dashboard and editor tools are available in your own website workspace.'}]}),
 section('contact','ContactSplit',{heading:'Let’s make something great.',intro:'Use this demo form to explore field settings. No real enquiries are collected for this fictional studio.',email:'hello@willow.example',imageUrl:'/uploads/support-demo/studio.jpg',imageAlt:'A bright studio workspace'})]},
 ...[['about','About'],['services','Services'],['contact','Contact']].map(([id,title])=>({id,path:`/${id}`,title,h1:title,seo:{title:`${title} | Willow Studio`,description:`${title} for the fictional Willow Studio demo.`},sections:[section(`${id}-hero`,'HeroEditorial',{eyebrow:'WILLOW STUDIO',heading:title,body:'Thoughtful design, clear communication, and a little inspiration. This is an example page for the help center.',imageUrl:photo,imageAlt:'A team planning their next project',primaryCta:{label:'Get in touch',href:'/contact'}}),...(id==='contact'?[section('contact-form','ContactSplit',{email:'hello@willow.example'})]:[])]}))]
 const tokens=structuredClone(defaultTokens);Object.assign(tokens.palette,{primary:'#6B4EE6',primaryForeground:'#ffffff',foreground:'#14243A',surface:'#F8F7FC',accent:'#0E8F82',border:'#E7E5EF',muted:'#55607A'});tokens.maxWidth=1200
 const nav=pages.map(p=>({label:p.title,href:p.path}))
 const model=websiteModelSchema.parse({schemaVersion:'1.0.0',site:{name:'Willow Studio',previewHost:`${marker}.example.invalid`},businessProfileRef:marker,designDna:{direction:'modern-minimal',composition:{symmetry:'symmetric',density:'balanced',width:'contained',rhythm:'modular'},typography:{headingStyle:'geometric-sans',bodyStyle:'clean-sans',scale:'standard'},imagery:{style:'documentary',dominance:'low',treatment:'natural'},navigation:'compact-sticky',motion:'none',corners:'soft',ctaStyle:'solid',colorBehavior:'tonal'},tokens,navigation:{primaryMenu:pages.map(p=>({label:p.title,pageId:p.id}))},globalComponents:{header:{componentId:'HeaderSplitUtility',props:{...structuredClone(getComponent('HeaderSplitUtility')!.fixture) as object,logoText:'Willow Studio',phone:'',items:nav,cta:{label:'Start a project',href:'/contact'}}},footer:{componentId:'FooterEditorial',props:{businessName:'Willow Studio',tagline:'A fictional studio. A real editing experience.',email:'hello@willow.example',columns:[{title:'Explore',items:nav}],socials:[],legalLinks:[]}}},pages,contact:{email:'hello@willow.example'},publishSettings:{robotsAllowIndexing:false}})
 const result=await prisma.$transaction(async tx=>{
 const user=await tx.user.create({data:{email:`${marker}@example.invalid`,name:'Demo Customer',emailVerified:new Date(),isPlatformAdmin:false,isPlatformSupport:false}})
 const workspace=await tx.workspace.create({data:{name:'Willow Studio workspace',slug:marker,billingExempt:true,billingExemptionReason:'Isolated support documentation demo; no payments or external publishing.',members:{create:{userId:user.id,role:'OWNER',canPublish:true}}}})
 const project=await tx.project.create({data:{workspaceId:workspace.id,name:'Willow Studio',slug:'willow-studio',previewHost:`${marker}.example.invalid`,status:'DRAFT'}})
 await tx.websiteVersion.create({data:{projectId:project.id,version:1,kind:'DRAFT',schemaVersion:'1.0.0',model:JSON.parse(JSON.stringify(model)),note:'Fictional support documentation website; ordinary customer account'}})
 for(const[file]of assets)await tx.asset.create({data:{workspaceId:workspace.id,projectId:project.id,source:'PLACEHOLDER',kind:'IMAGE',url:`/uploads/support-demo/${file}`,storageKey:`support-demo/${file}`,mimeType:'image/jpeg',altText:'Example studio photography for support documentation'}})
 return{projectId:project.id,userId:user.id,workspaceId:workspace.id}
 })
 writeFileSync(fixtureFile,JSON.stringify(result,null,2),{mode:0o600})
 console.log('Created one normal customer (no admin/support flags), isolated demo workspace, fictional four-page website, and three demo image assets. No AI generation, emails, payments, or publishing requested.')
 }
} finally {await prisma.$disconnect()}
