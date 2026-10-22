import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { JSDOM } from 'jsdom'
import { importedTemplates, getComponent, defaultTokens, templatePageComponents } from '@awb/component-registry'
import { templateColorVars } from '../packages/component-registry/src/template-colors'
Object.assign(globalThis, { React })
const tokens = { ...defaultTokens, palette: { ...defaultTokens.palette, primary: '#025727', accent: '#d69804' } }
const vars = templateColorVars(tokens) as Record<string, unknown>
assert.equal(vars['--color-primary'], '#025727')
assert.equal(vars['--color-secondary'], '#d69804')
let count = 0
for (const template of importedTemplates) {
  const context = { tokens, baseUrl: '/preview/test', pagePath: '/', serviceLinks: [{ label: 'Renovations', href: '/services/renovations' }] }
  const ids = [template.header, ...new Set(['/', '/about', '/services', '/services/detail', '/contact'].flatMap(path => templatePageComponents(template.id, path))), template.footer]
  const html = ids.map(id => {
    const definition = getComponent(id)
    assert.ok(definition, `Missing component: ${id}`)
    const props = definition.propsSchema.parse({ ...definition.fixture, businessName: 'Our business', logoText: 'Our business', logoImageUrl: '/uploads/our-logo.png', items: [{ label: 'Services', href: '/services', children: [{ label: 'Renovations', href: '/services/renovations' }] }] })
    count++
    return renderToStaticMarkup(React.createElement(definition.render, { props, context }))
  }).join('')
  const dom = new JSDOM(html)
  for (const link of dom.window.document.querySelectorAll('link[rel="stylesheet"]')) {
    const href = link.getAttribute('href')!.split('?')[0]!
    assert.ok(href.includes('/webtummy-'), `${template.id}: branded stylesheet`)
    assert.ok(existsSync(resolve('apps/web/public', '.' + href)), href)
    const css = readFileSync(resolve('apps/web/public', '.' + href), 'utf8')
    assert.ok(css.includes('var(--awb-primary'), `${template.id}: uses selected palette`)
  }
  assert.ok(!html.includes('/template-library/finbiz/') && !html.includes('/template-library/insurigo/'), template.id)
  assert.ok(html.includes('src="/uploads/our-logo.png"'), `${template.id}: uploaded logo retained`)
  assert.ok(html.includes('/preview/test/services/renovations'), `${template.id}: service dropdown retained`)
  assert.ok(!html.includes('/preview/test/uploads/'), `${template.id}: logo path must not be prefixed`)
  dom.window.close()
}
console.log(`PASS: ${importedTemplates.length} branded layouts, ${count} rendered sections; brand colours, CSS assets, uploaded logos and menu dropdowns.`)

const classicHero = getComponent('Tpl_finbiz_1_1')!
const portraitHtml = renderToStaticMarkup(React.createElement(classicHero.render, { props: classicHero.propsSchema.parse({ ...classicHero.fixture, heroImageFit: 'contain', imageUrl: '/uploads/agent-portrait.png', imageAlt: 'Uploaded agent' }), context: { tokens, baseUrl: '/preview/test', pagePath: '/' } }))
const portraitDom = new JSDOM(portraitHtml)
assert.equal(portraitDom.window.document.querySelector('img.awb-classic-hero-portrait')?.getAttribute('src'), '/uploads/agent-portrait.png')
assert.equal(portraitDom.window.document.querySelector('.swiper-slide')?.getAttribute('style')?.includes('background-image:none'), true)
assert.equal(portraitDom.window.document.querySelector('[data-hero-image-fit]')?.getAttribute('data-hero-image-fit'), 'contain')
portraitDom.window.close()
console.log('PASS: Classic portrait mode renders a dedicated image within the existing hero; cover background removed.')
