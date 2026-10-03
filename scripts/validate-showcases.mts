import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { JSDOM } from 'jsdom'
import JSZip from 'jszip'
import { getComponent, defaultTokens, emptyImagePointers, colorTargets, componentLayoutNodes, validateSectionProps } from '@awb/component-registry'
import { StubAiProvider } from '@awb/ai'
import { websiteModelSchema } from '@awb/website-model'
import { buildStaticExport } from '../apps/web/src/lib/static-export'
Object.assign(globalThis, { React })
const work = { title: 'Oak desk', category: 'Furniture', description: 'A user-supplied product description.', imageUrl: 'https://images.example.com/desk.png', imageAlt: 'Oak desk on a neutral background', href: '/products/oak-desk', linkLabel: 'Explore desk' }
const badge = { title: 'User-supplied certification', issuer: 'Example issuer', year: '2026', imageUrl: 'https://images.example.com/badge.png', imageAlt: 'Uploaded certificate', href: 'https://issuer.example.com/check' }
const sections = ['PortfolioShowcase', 'CredentialsShowcase'].map((componentId, index) => {
  const definition = getComponent(componentId)!
  assert.ok(definition)
  const props = definition.propsSchema.parse({ items: index ? [badge] : [work, { ...work, title: 'Reading lamp', category: 'Lighting' }], sectionBackgroundMode: 'colour', sectionBackgroundColor: '#102030', elementColors: { '/items/0': { backgroundColor: '#abcdef' } } }) as Record<string, unknown>
  assert.equal(validateSectionProps('test', componentId, props).ok, true)
  assert.deepEqual(emptyImagePointers(componentId, { items: [{ title: 'Unverified', imageUrl: '' }] }), [], 'Never auto-generate evidence images')
  const render = (scope: string, editing = false, values = props) => renderToStaticMarkup(React.createElement(definition.render, { props: values, context: { tokens: defaultTokens, baseUrl: '', staticRenderScope: scope, editing } }))
  const html = render('showcase-' + index)
  const doc = new JSDOM(html).window.document
  assert.equal(doc.querySelectorAll('article').length, index ? 1 : 2)
  assert.equal(doc.querySelector('img')?.getAttribute('src'), index ? badge.imageUrl : work.imageUrl)
  assert.ok(html.includes('background:#102030'))
  assert.ok(html.includes('background:#abcdef'))
  assert.ok(colorTargets(componentId, props).some(target => target.path === '/items/0'))
  assert.ok(componentLayoutNodes(componentId, props).length)
  assert.ok(!render('empty', false, definition.propsSchema.parse({}) as Record<string, unknown>).includes('<section'), 'Empty showcases do not publish empty claims')
  assert.ok(render('empty-editor', true, definition.propsSchema.parse({}) as Record<string, unknown>).includes('Properties'), 'Editor explains how to populate empty section')
  assert.equal(render('showcase-' + index), html, 'Static output has stable scopes')
  if (!index) {
    assert.equal(doc.querySelectorAll('input[type=radio]').length, 3)
    assert.ok(!render('editor', true).includes('type="radio"'), 'Editor keeps all projects visible')
    assert.ok(html.includes('@container(min-width:720px)'), 'Featured card responds to actual section width')
    assert.notEqual(doc.querySelector('input')?.getAttribute('name'), new JSDOM(render('other')).window.document.querySelector('input')?.getAttribute('name'), 'Multiple portfolios have independent filters')
  } else assert.equal((doc.querySelector('img') as HTMLImageElement).style.objectFit, 'contain')
  for (const href of ['javascript:alert(1)', '//attacker.example.com', 'data:text/html,bad']) assert.equal(definition.propsSchema.safeParse({ items: [{ title: 'Bad link', href }] }).success, false)
  return { id: 'showcase-' + index, componentId, componentVersion: '1.0.0', props, hidden: false }
})
const brief = { businessName: 'Example furniture', description: 'Real furniture designed and sold by our small studio.', services: [], goals: ['FORM'], tonePreferences: [], answers: {}, hasLogo: false, logoColors: [], uploadedImageUrls: [], testimonials: [] }
const stub = new StubAiProvider({ seed: 'showcase-test' })
const { data: analysis } = await stub.analyzeBrief(brief)
const { data: directions } = await stub.proposeDesignDirections(brief, analysis)
const chrome = (id: string) => ({ componentId: id, props: getComponent(id)!.fixture })
const model = websiteModelSchema.parse({ schemaVersion: '1.0.0', site: { name: brief.businessName, previewHost: 'example.preview.local' }, businessProfileRef: 'test', designDna: directions.options[0]!.dna, tokens: defaultTokens, navigation: { primaryMenu: [] }, globalComponents: { header: chrome('HeaderSplitUtility'), footer: chrome('FooterCompact') }, pages: [{ id: 'home', path: '/', title: 'Our work', h1: 'Our work', seo: { title: 'Our work' }, sections }, { id: 'desk', path: '/products/oak-desk', title: 'Oak desk', h1: 'Oak desk', seo: { title: 'Oak desk' }, sections: [] }] })
const originalFetch = globalThis.fetch
const image = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a7XcAAAAASUVORK5CYII=', 'base64')
globalThis.fetch = async () => new Response(image, { headers: { 'Content-Type': 'image/png' } })
try {
  const zip = await JSZip.loadAsync(await buildStaticExport(model, { siteUrl: 'https://example.com' }))
  const html = await zip.file('index.html')!.async('string')
  const doc = new JSDOM(html).window.document
  const images = [...doc.querySelectorAll('img')]
  assert.equal(images.length, 3)
  for (const img of images) assert.ok(zip.file(img.getAttribute('src')!.replace(/^\.\//, '')), 'Image is bundled in ZIP')
  assert.equal(doc.querySelector('article a')?.getAttribute('href'), './products/oak-desk/index.html')
  assert.equal(doc.querySelectorAll('input[type=radio]').length, 3, 'Category filters work in exported HTML without React')
} finally { globalThis.fetch = originalFetch }
console.log('PASS: showcase rendering, uploads as image URLs, editable cards, independent category filters, responsive layout rules and ZIP assets/links.')
