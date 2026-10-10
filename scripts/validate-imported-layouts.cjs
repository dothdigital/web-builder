// Full generation uses disposable records, stub AI and local storage only.
require('dotenv').config({ path: require('node:path').resolve(__dirname, '../.env'), quiet: true })
process.env.AI_PROVIDER = 'stub'
process.env.NEXT_PUBLIC_ENABLE_LAYOUT_TEMPLATES = 'true'
process.env.S3_BUCKET = ''
process.env.LOCAL_UPLOAD_DIR = '/tmp/webtummy-layout-validation/uploads'
const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const path = require('node:path')
const { randomUUID } = require('node:crypto')
const React = require('react')
Object.assign(globalThis, { React })
const { renderToStaticMarkup } = require('react-dom/server')
const { JSDOM } = require('jsdom')
const JSZip = require('jszip')
const { prisma } = require('@awb/database')
const { runGeneration } = require('@awb/pipeline')
const { importedTemplates, importedSection, getComponent, templatePageComponents, templateGenerationComponents, defaultTokens } = require('@awb/component-registry')
const { websiteModelSchema } = require('@awb/website-model')
const { SiteRenderer } = require('../apps/web/src/components/site-renderer.tsx')
const { buildStaticExport } = require('../apps/web/src/lib/static-export.tsx')
const marker = `layout-validation-${randomUUID()}`
const output = '/tmp/webtummy-layout-validation'
const results = []
let workspaceId
async function main() {
  assert.equal(importedTemplates.length, 18)
  await fs.mkdir(output, { recursive: true })
  const reuse = process.argv.includes('--reuse-models')
  if (!reuse) {
    const workspace = await prisma.workspace.create({ data: { name: marker, slug: marker, billingExempt: true, billingExemptionReason: 'Disposable integration validation' } })
    workspaceId = workspace.id
  }
  for (const template of importedTemplates) {
    let model
    if (reuse) model = websiteModelSchema.parse(JSON.parse(await fs.readFile(path.join(output, `${template.id}.json`), 'utf8')))
    else {
    const project = await prisma.project.create({ data: {
      workspaceId, name: 'Cedar Advisory', slug: template.id, templateId: template.id,
      previewHost: `${marker}-${template.id}.validation.invalid`,
      businessProfile: { create: { displayName: 'Cedar Advisory', description: 'Cedar Advisory provides practical planning and operations support for local businesses.', industry: 'Consulting', city: 'Bristol', email: 'hello@cedar.example', phone: '+44 117 000 1234', serviceArea: ['Bristol'], missingFacts: [] } },
      collections: { create: { type: 'SERVICES', name: 'Services', items: { create: [{ position: 0, data: { title: 'Business planning' } }, { position: 1, data: { title: 'Operations support' } }] } } },
    } })
    assert.equal((await prisma.project.findUniqueOrThrow({ where: { id: project.id } })).templateId, template.id)
    const generated = await runGeneration({ projectId: project.id })
    const version = await prisma.websiteVersion.findUniqueOrThrow({ where: { id: generated.websiteVersionId } })
    model = websiteModelSchema.parse(version.model)
    const jobs = await prisma.generationJob.findMany({ where: { projectId: project.id } })
    assert.ok(jobs.every(job => job.status === 'SUCCEEDED'), JSON.stringify(jobs.map(job => [job.stage, job.status])))
    assert.ok(jobs.every(job => !job.costCents), 'No paid AI usage')
    }
    assert.equal(model.globalComponents.header.componentId, template.header)
    assert.equal(model.globalComponents.footer.componentId, template.footer)
    let imageControls = 0, textControls = 0, linkControls = 0
    for (const page of model.pages) {
      assert.deepEqual(page.sections.map(section => section.componentId), templatePageComponents(template.id, page.path))
      const allowed = templateGenerationComponents(template.id, page.path)
      for (const section of page.sections) {
        const definition = getComponent(section.componentId)
        definition.propsSchema.parse(section.props)
        if (!allowed.includes(section.componentId)) assert.equal(section.hidden, true, `${template.id}: unsupported proof must be hidden`)
        for (const field of definition.editorFields.filter(field => ['image', 'text', 'textarea', 'link'].includes(field.type))) {
          const key = field.path.slice(1)
          const edited = { ...section.props, [key]: field.type === 'image' ? '/uploads/test.svg' : field.type === 'link' ? '/contact' : 'Edited Cedar content' }
          const html = renderToStaticMarkup(React.createElement(definition.render, { props: definition.propsSchema.parse(edited), context: { tokens: defaultTokens, baseUrl: '', editing: true } }))
          if (importedSection(section.componentId).fields.some(item => item.path === field.path)) {
            assert.ok(html.includes(field.type === 'image' ? '/uploads/test.svg' : field.type === 'link' ? '/contact' : 'Edited Cedar content'), `${section.componentId} ${field.path}: edit rendered`)
          }
          if (field.type === 'image') imageControls++
          else if (field.type === 'link') linkControls++
          else textControls++
        }
      }
      const html = renderToStaticMarkup(React.createElement(SiteRenderer, { model, page, baseUrl: '', forms: { projectId: 'test', action: 'https://webtummy.com/api/leads/test' } }))
      const doc = new JSDOM(html).window.document
      assert.doesNotMatch(doc.body.textContent, /webtummy-insurance|webtummy-business|elevate your business|john doe|david smith|\$\s?\d/i, `${template.id} ${page.path}: demo copy leaked`)
      for (const anchor of doc.querySelectorAll('a[href]')) assert.doesNotMatch(anchor.getAttribute('href'), /\.html|Webtummy|webtummy|Webtummy/i)
      for (const image of doc.querySelectorAll('img[src]')) assert.doesNotMatch(image.getAttribute('src'), /\/testimonials\/.*logo|award-logo|\/faq\/logo|\/logo\/logo|\/user\//i, `${template.id}: demo logo or staff image leaked`)
      if (page.path === '/contact') assert.ok(doc.querySelector('form'), `${template.id}: contact form present`)
      await fs.mkdir(path.join(output, template.id, page.path), { recursive: true })
      await fs.writeFile(path.join(output, template.id, page.path, 'index.html'), `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body>${html}</body></html>`)
    }
    const zip = await JSZip.loadAsync(await buildStaticExport(model, { siteUrl: 'https://cedar.example', forms: { projectId: 'test', action: 'https://webtummy.com/api/leads/test' } }))
    assert.ok(zip.file(`template-library/${template.theme}/editable.css`))
    const cssPath = `template-library/${template.theme}/editable.css`
    const css = await zip.file(cssPath).async('string')
    for (const match of css.matchAll(/url\(['"]?([^)'"\s]+)['"]?\)/g)) {
      const url = match[1].split(/[?#]/)[0]
      if (!url || /^(https?:|data:)/.test(url)) continue
      assert.ok(zip.file(path.posix.normalize(path.posix.join(path.posix.dirname(cssPath), url))), `${template.id}: missing exported CSS asset ${url}`)
    }
    for (const page of model.pages) {
      const file = page.path === '/' ? 'index.html' : `${page.path.slice(1)}/index.html`
      const html = await zip.file(file).async('string')
      assert.ok(!html.includes('href="/template-library/'))
      const doc = new JSDOM(html).window.document
      for (const element of doc.querySelectorAll('img[src],link[rel="stylesheet"]')) {
        const url = element.getAttribute('src') || element.getAttribute('href')
        if (/^(https?:|data:)/.test(url)) continue
        assert.ok(zip.file(path.posix.normalize(path.posix.join(path.posix.dirname(file), url))), `${template.id}: exported asset missing ${url}`)
      }
    }
    await fs.writeFile(path.join(output, `${template.id}.json`), JSON.stringify(model))
    results.push({ id: template.id, pages: model.pages.length, textControls, imageControls, linkControls, status: 'passed' })
    console.log(`PASS ${template.id}: ${model.pages.length} pages, generation, proof filtering, editable controls, export`)
  }
}
main().catch(error => { console.error(error); process.exitCode = 1 }).finally(async () => {
  if (workspaceId) { await prisma.auditEvent.deleteMany({ where: { workspaceId } }); await prisma.workspace.delete({ where: { id: workspaceId } }) }
  await prisma.$disconnect()
  await fs.writeFile(path.join(output, 'results.json'), JSON.stringify({ results, complete: results.length === 18 }, null, 2))
})
