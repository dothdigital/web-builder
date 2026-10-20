import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { JSDOM } from 'jsdom'
import { getComponent, importedTemplates, defaultTokens, resolveBusinessContact } from '@awb/component-registry'
import type { WebsiteModel } from '@awb/website-model'
import { resolveEditorMedia } from '../apps/web/src/lib/editor-media'
import { SiteRenderer } from '../apps/web/src/components/site-renderer'
Object.assign(globalThis, { React })
const header = getComponent('HeaderSplitUtility')!, footer = getComponent('FooterEditorial')!
const section = (componentId: string, index: number) => ({ id: 's-' + index, componentId, componentVersion: '1.0.0', hidden: false, props: { ...getComponent(componentId)!.fixture as object } })
const model = {
  site: { name: 'Contact test', locale: 'en', previewHost: 'contact-test.preview.local' }, tokens: defaultTokens,
  businessDetails: { displayName: 'Contact test', description: '', industry: '', tagline: '', audience: '', tone: '' },
  contact: { email: 'primary@example.com', phone: '+1 555 1000', emails: ['primary@example.com', 'team@example.com'], phones: ['+1 555 1000', '+1 555 2000'], addressLine1: '42 Updated Street', city: 'Toronto', hours: [{ day: 'Monday', opens: '09:00', closes: '17:00', closed: false }] },
  socials: [{ network: 'Instagram', url: 'https://instagram.com/example' }],
  globalComponents: { header: { componentId: header.componentId, componentVersion: header.version, props: { ...header.fixture as object, phone: '+1 555 9999' } }, footer: { componentId: footer.componentId, componentVersion: footer.version, props: { ...footer.fixture as object, phone: '+1 555 9999', email: 'stale@example.com', address: 'Old Address', socials: [{ platform: 'Facebook', href: 'https://facebook.com/stale' }] } } },
  navigation: { primaryMenu: [] }, pages: [],
} as unknown as WebsiteModel
const scenarios = [['ContactSplit'], ...Array.from(new Set(importedTemplates.map(template => JSON.stringify(template.secondary.contact.filter(id => getComponent(id)?.family === 'CONTACT'))))).map(value => JSON.parse(value) as string[])]
for (const ids of scenarios) {
  const source = { ...model, pages: [{ id: 'contact', path: '/contact', title: 'Contact', sections: ids.map(section) }] } as WebsiteModel
  const before = JSON.stringify(source)
  const resolved = resolveEditorMedia(source, {})
  const editorHtml = resolved.pages[0]!.sections.map(entry => {
    const definition = getComponent(entry.componentId)!
    return renderToStaticMarkup(React.createElement(definition.render, { props: definition.propsSchema.parse(entry.props), context: { tokens: defaultTokens, baseUrl: '', editing: true } }))
  }).join('')
  const publishedHtml = renderToStaticMarkup(<SiteRenderer model={source} page={source.pages[0]!} baseUrl="" staticExport />)
  for (const [mode, html] of [['editor', editorHtml], ['published', publishedHtml]]) {
    const dom = new JSDOM(html), details = dom.window.document.querySelector('[data-awb-business-contact]')!
    assert.ok(details, `${mode}: ${ids}`)
    assert.ok(details.textContent!.includes('42 Updated Street, Toronto'))
    assert.ok(details.querySelector('a[href="mailto:team@example.com"]'))
    assert.ok(details.querySelector('a[href="tel:+1 555 2000"]'))
    assert.ok(details.querySelector('a[aria-label="Instagram"] svg'))
    assert.ok(!html.includes('stale@example.com'))
    assert.ok(!html.includes('+1 555 9999'))
  }
  assert.equal(JSON.stringify(source), before, 'Rendering must preserve saved section content and undo history')
  const cleared = { ...source, contact: { email: '', phone: '', emails: [], phones: [], hours: [] }, socials: [] } as WebsiteModel
  const clearedHtml = renderToStaticMarkup(<SiteRenderer model={cleared} page={cleared.pages[0]!} baseUrl="" staticExport />)
  assert.ok(!clearedHtml.includes('mailto:primary@example.com'))
  assert.ok(!clearedHtml.includes('https://facebook.com/stale'))
  assert.ok(!clearedHtml.includes('stale@example.com'))
  assert.ok(!clearedHtml.includes('42 Updated Street'))
}
for (const headerId of new Set(importedTemplates.map(template => template.header))) {
  const definition = getComponent(headerId)!
  const before = renderToStaticMarkup(React.createElement(definition.render, { props: definition.propsSchema.parse(definition.fixture), context: { tokens: defaultTokens, baseUrl: '' } }))
  if (!/class="[^"]*social/.test(before)) continue
  const headerModel = { ...model, globalComponents: { ...model.globalComponents, header: { componentId: headerId, componentVersion: '1.0.0', props: { ...definition.fixture as object } } } }
  const resolved = resolveBusinessContact(headerModel).globalComponents.header
  const html = renderToStaticMarkup(React.createElement(definition.render, { props: definition.propsSchema.parse(resolved.props), context: { tokens: defaultTokens, baseUrl: '' } }))
  assert.ok(html.includes('aria-label="Instagram"'), headerId)
  const cleared = resolveBusinessContact({ ...headerModel, socials: [] }).globalComponents.header
  const removed = renderToStaticMarkup(React.createElement(definition.render, { props: definition.propsSchema.parse(cleared.props), context: { tokens: defaultTokens, baseUrl: '' } }))
  assert.ok(!removed.includes('aria-label="Instagram"'), headerId)
}
const ctaModel = { ...model, pages: [{ id: 'home', path: '/', sections: [{ id: 'call', componentId: 'CtaBand', props: { primaryCta: { label: 'Call us', href: 'tel:+1 555 9999' } } }] }] } as unknown as WebsiteModel
assert.equal((resolveBusinessContact(ctaModel).pages[0]!.sections[0]!.props.primaryCta as {href: string}).href, 'tel:+1 555 1000')
console.log('PASS: shared details render in standard and imported contact sections, editor and published output; stale details and removed socials disappear; header and call links synchronize; source models stay unchanged.')
