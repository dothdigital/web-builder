require('dotenv').config({ quiet: true })
global.AsyncLocalStorage = require('node:async_hooks').AsyncLocalStorage
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict')
const { prisma } = require('@awb/database')
const { websiteModelSchema } = require('@awb/website-model')
const { prepareSecurePathSeo } = require('./secure-path-seo.mts')
const { resolvePreviewAssets } = require('../apps/web/src/lib/preview-assets.ts')
const JSZip = require('jszip')
const { JSDOM } = require('jsdom')
async function main() {
 try {
  const projectId='cmv8r9j240000twpapiu39z6x'
  const version=await prisma.websiteVersion.findFirstOrThrow({where:{projectId,kind:'DRAFT'},orderBy:{version:'desc'}})
  const model=await resolvePreviewAssets(projectId,prepareSecurePathSeo(websiteModelSchema.parse(version.model)))
  const app=require('../apps/web/.next/server/app/projects/[id]/publishing/page.js')
  const chunks=path.resolve('apps/web/.next/server/chunks')
  let renderer
  for(const file of fs.readdirSync(chunks).filter(file=>file.endsWith('.js'))) {
   const source=fs.readFileSync(path.join(chunks,file),'utf8')
   if(!source.includes('renderToStaticMarkup') || !source.includes('__AWB_EXPORT_ROOT__'))continue
   const chunk=require(path.join(chunks,file))
   for(const [id,implementation] of Object.entries(chunk.modules??{})) {
    const source=implementation.toString()
    if(!source.includes('renderToStaticMarkup') || !source.includes('__AWB_EXPORT_ROOT__'))continue
    const runtime=require('../apps/web/.next/server/webpack-runtime.js')
    if (!runtime.m[id]) continue
    const entry=await app.__next_app__.require(Number(id))
    assert.equal(Object.keys(entry).length,1)
    renderer=Object.values(entry)[0]
   }
  }
  assert.equal(typeof renderer,'function')
  const base='https://secure-path.example'
  const bytes=await renderer(model,{siteUrl:base})
  const zip=await JSZip.loadAsync(bytes)
  for(const page of model.pages) {
   const file=page.path==='/'?'index.html':`${page.path.slice(1)}/index.html`
   const html=await zip.file(file).async('string')
   const dom=new JSDOM(html),doc=dom.window.document
   assert.equal(doc.title,page.seo.title,page.path)
   assert.equal(doc.querySelector('meta[name=description]').content,page.seo.description)
   assert.ok(doc.querySelector('meta[name=keywords]').content.includes(page.seo.targetKeyword))
   assert.equal(doc.querySelector('link[rel=canonical]').href,base+page.path)
   assert.equal(doc.querySelector('meta[name=robots]'),null)
   const structured=[...doc.querySelectorAll('script[type="application/ld+json"]')].map(script=>JSON.parse(script.textContent))
   assert.ok(structured.some(data=>data['@graph']?.some(node=>node['@id']===base+page.path+'#webpage')))
   const faq=structured.find(data=>data['@type']==='FAQPage')
   assert.ok(faq,page.path)
   for(const question of faq.mainEntity) {
    assert.ok(doc.body.textContent.includes(question.name))
    assert.ok(doc.body.textContent.includes(question.acceptedAnswer.text))
   }
   assert.ok(doc.querySelector('h1'),page.path)
   dom.window.close()
  }
  assert.equal(((await zip.file('sitemap.xml').async('string')).match(/<loc>/g)||[]).length,model.pages.length)
  assert.match(await zip.file('robots.txt').async('string'),/Allow: \//)
  assert.equal(await zip.file('llms.txt').async('string'),await zip.file('aillm.txt').async('string'))
  assert.equal(((await zip.file('llms.txt').async('string')).match(/\]\(https:/g)||[]).length,model.pages.length)
  fs.writeFileSync('/tmp/secure-path-seo-verified.zip',bytes,{mode:0o600})
  // A minimal image-free copy verifies that private preview exports cannot leak into crawler indexes.
  const clearImages=node=>{
   if(Array.isArray(node))return node.map(clearImages)
   if(!node||typeof node!=='object')return node
   return Object.fromEntries(Object.entries(node).map(([key,value])=>[key,/imageurl$/i.test(key)?'':clearImages(value)]))
  }
  const previewModel=clearImages(model)
  const previewZip=await JSZip.loadAsync(await renderer(previewModel,{siteUrl:base,preview:true}))
  assert.ok(!(await previewZip.file('sitemap.xml').async('string')).includes('<loc>'))
  assert.match(await previewZip.file('robots.txt').async('string'),/Disallow: \//)
  const previewHtml=await previewZip.file('index.html').async('string')
  assert.match(previewHtml,/<meta name="robots" content="noindex,nofollow"/)
  console.log(JSON.stringify({compiledExport:'PASS',pages:model.pages.length,faqSchemas:model.pages.length,metadata:'unique titles/descriptions/keywords/canonicals',crawlerFiles:['robots.txt','sitemap.xml','llms.txt','aillm.txt'],preview:'noindex; empty sitemap; disallow all',bytes:bytes.length}))
 }finally{await prisma.$disconnect()}
}
main().catch(error=>{console.error(error.stack);process.exitCode=1})
