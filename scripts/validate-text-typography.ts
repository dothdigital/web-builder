import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { getComponent, defaultTokens, colorTargets } from '@awb/component-registry'
Object.assign(globalThis, { React })
const cases = [
  ['HeroEditorial', '/heading', {}],
  ['HeaderTransparent', '/items/0/label', {}],
  ['HeaderSplitUtility', '/items/3/label', {}],
  ['HeaderTransparent', '/logoText', {}],
  ['FooterEditorial', '/tagline', {}],
  ['FooterCompact', '/legalLinks/0/label', {}],
  ['ContactSplit', '/formFields/0/label', {}],
  ['ContactSplit', '/submitLabel', {}],
  ['AboutSplitOverlap', '/stats/0/value', { stats: [{ value: '10', label: 'Years' }] }],
  ['ReviewsEditorialQuote', '/testimonials/0/quote', { testimonials: [{ quote: 'Great', author: 'Sam' }] }],
] as const
for (const [id, path, extra] of cases) {
  const definition = getComponent(id)!
  const props = definition.propsSchema.parse({ ...(definition.fixture as Record<string, unknown>), ...extra, elementColors: { [path]: { fontFamily: 'Georgia, serif', fontSize: 31, fontWeight: 700, fontStyle: 'italic' } } })
  assert.ok(colorTargets(id, props as Record<string, unknown>).some((target) => target.path === path), `${id} control for ${path}`)
  const html = renderToStaticMarkup(React.createElement(definition.render, { props, context: { tokens: defaultTokens, baseUrl: '' } }))
  assert.ok(html.includes('font-family:Georgia, serif;font-size:31px;font-weight:700') || (html.includes('font-family:Georgia, serif') && html.includes('font-size:31px') && html.includes('font-weight:700')), `${id} styles render`)
  assert.equal((html.match(/font-style:italic/g) ?? []).length, 1, `${id} italic only on selected text`)
  assert.equal((html.match(/font-size:31px/g) ?? []).length, 1, `${id} styles only selected text`)
}
console.log('PASS: typography controls persist and render independently in headings, menus, logos, footers, forms, stats and reviews.')
