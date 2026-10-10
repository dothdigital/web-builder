import React from 'react'
import{renderToStaticMarkup}from'react-dom/server'
import{mkdirSync,writeFileSync,readFileSync}from'node:fs'
import{resolve}from'node:path'
import{JSDOM}from'jsdom'
import{defaultTokens,importedTemplates,importedSection,templatePageComponents,ensureServiceDetailPages,ensureContactPageLayout,normalizeSiteHeadings}from'@awb/component-registry'
import type{WebsiteModel}from'@awb/website-model'
import{SiteRenderer}from'../apps/web/src/components/site-renderer'
Object.assign(globalThis,{React})
const directory=resolve('apps/web/public/template-library/previews')
mkdirSync(directory,{recursive:true})
const pageFile=(id:string,path:string)=>`${id}${path==='/'?'':path.replaceAll('/','-')}.html`
let files=0
for(const template of importedTemplates){
 const pages=['/','/about','/services','/contact'].map((path,index)=>({id:`page-${index}`,path,title:path==='/'?'Home':path.slice(1).replace(/^./,c=>c.toUpperCase()),navLabel:path==='/'?'Home':path.slice(1).replace(/^./,c=>c.toUpperCase()),pageType:'CUSTOM',h1:'',seo:{title:'Webtummy template preview',description:'Sample Webtummy website design',index:false},sections:templatePageComponents(template.id,path).filter(id=>!['HEADER','FOOTER'].includes(importedSection(id)!.family)).map((componentId,index)=>({id:`section-${index}`,componentId,componentVersion:'1.0.0',hidden:false,props:{...importedSection(componentId)!.fixture}}))}))
 const source={site:{name:'Webtummy',slug:'webtummy',defaultLocale:'en'},tokens:{...defaultTokens,palette:{...defaultTokens.palette,primary:'#0b77d5',primaryForeground:'#ffffff',accent:'#185eaa'}},pages,contact:{email:'demo@example.com',phone:'(555) 010-1234',hours:[]},socials:[],navigation:{primaryMenu:pages.map(page=>({label:page.title,linkType:'PAGE',pageId:page.id,newTab:false,children:[]})),footerMenu:[],utilityMenu:[]},globalComponents:{header:{componentId:template.header,componentVersion:'1.0.0',props:{logoText:'Webtummy',businessName:'Webtummy',logoImageUrl:'/template-library/webtummy-logo.svg',items:pages.map(page=>({label:page.title,href:page.path}))}},footer:{componentId:template.footer,componentVersion:'1.0.0',props:{businessName:'Webtummy',logoImageUrl:'/template-library/webtummy-logo.svg',tagline:'Sample website layout',columns:[]}}}}as unknown as WebsiteModel
 const model=normalizeSiteHeadings(ensureContactPageLayout(ensureServiceDetailPages(source)))
 for(const page of model.pages){
  const markup=renderToStaticMarkup(<SiteRenderer model={model} page={page} baseUrl=""/>)
  const dom=new JSDOM(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${template.name} · Webtummy</title><style>body{margin:0;font-family:Arial,Helvetica,sans-serif}img{max-width:100%}</style></head><body>${markup}</body></html>`)
  for(const anchor of dom.window.document.querySelectorAll<HTMLAnchorElement>('a[href]')){
   const href=anchor.getAttribute('href')!
   if(model.pages.some(page=>page.path===href))anchor.setAttribute('href',`/template-library/previews/${pageFile(template.id,href)}`)
  }
  writeFileSync(resolve(directory,pageFile(template.id,page.path)),dom.serialize());files++
 }
}
for(const filename of ['packages/shared/src/layout-catalogue.json','packages/component-registry/src/imported/layouts.json']){
 const data=JSON.parse(readFileSync(filename,'utf8'))
 const templates=Array.isArray(data)?data:data.templates
 for(const template of templates)template.preview=`/template-library/previews/${pageFile(template.id,'/')}`
 writeFileSync(filename,JSON.stringify(data,Array.isArray(data)?null:undefined,Array.isArray(data)?2:undefined)+'\n')
}
console.log(`Built ${files} Webtummy preview pages using the shared website renderer`)
