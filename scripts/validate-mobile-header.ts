import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { getComponent, defaultTokens, mobileMenuColors } from '@awb/component-registry'
Object.assign(globalThis, { React })
for (const id of ['HeaderTransparent', 'HeaderSplitUtility']) {
  const definition = getComponent(id)!
  for (const logoAlignment of ['original', 'left', 'center', 'right']) {
    const props = definition.propsSchema.parse({ ...definition.fixture as object, logoAlignment, cta: { label: 'Get in touch', href: '/contact' } })
    const html = renderToStaticMarkup(React.createElement(definition.render, { props, context: { tokens: defaultTokens, baseUrl: '/preview/site' } }))
    assert.match(html, /<details class="awb-mobile-menu">/)
    assert.match(html, /<summary aria-label="Navigation menu" style="background:[^"]+"/)
    assert.match(html, /@container awb-navigation \(max-width:767px\)/)
    const start = html.indexOf('<details class="awb-mobile-menu">')
    const end = html.lastIndexOf('</details>')
    assert.ok(html.indexOf('Get in touch', start) < end, 'CTA stays inside mobile disclosure')
    assert.match(html.slice(start, end), /href="\/preview\/site\/contact"/)
    assert.equal((html.match(/data-awb-element="\/cta"/g) ?? []).length, 1, 'One CTA for both viewports')
    assert.equal((html.match(/data-awb-element="\/logoText"/g) ?? []).length, 1, 'One logo for both viewports')
  }
}
console.log('PASS: mobile disclosure, shared editor-width breakpoint, contact CTA containment, base URLs, and no duplicate logo/CTA across header variants.')

assert.equal(mobileMenuColors({ sectionBackgroundMode: 'colour', sectionBackgroundColor: '#1f3151' }, defaultTokens).color, '#ffffff')
assert.equal(mobileMenuColors({ customBackground: true, backgroundColor: '#ffffff' }, defaultTokens).color, '#000000')
assert.equal(mobileMenuColors({ mobileMenuIconColor: '#ffcc00' }, defaultTokens).color, '#ffcc00')
console.log('PASS: automatic light/dark hamburger contrast and custom override.')
