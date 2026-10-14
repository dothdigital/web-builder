// Fail if any static layout relies on a React hook dispatcher.
const assert = require('node:assert/strict')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const reactPath = require.resolve('react')
require.cache[reactPath].exports = { ...React, useId() { throw new Error('Static exports cannot call useId') } }
global.React = require('react')
const { getComponent, listComponents, defaultTokens } = require('@awb/component-registry')
const overrides = {
  ManualSection: { items: [{ id: 'first', kind: 'columns' }, { id: 'second', kind: 'columns' }] },
  ReviewsTrustStrip: { testimonials: [{ quote: 'First review', author: 'First customer' }, { quote: 'Second review', author: 'Second customer' }], layout: 'cards' },
  PortfolioShowcase: { items: [{ title: 'First project' }, { title: 'Second project' }] },
  CredentialsShowcase: { items: [{ title: 'First credential' }, { title: 'Second credential' }] },
  BlogListing: { items: [{ title: 'First article', description: 'Article description', href: '/blog/first' }] },
}
let grids = 0
for (const definition of listComponents()) {
  const props = definition.propsSchema.parse({ ...definition.fixture, ...overrides[definition.componentId] })
  const context = { staticRenderScope: `section-${definition.componentId}`, tokens: defaultTokens, baseUrl: '', editing: false }
  const render = () => renderToStaticMarkup(React.createElement(definition.render, { props, context }))
  const html = render()
  const ids = [...html.matchAll(/\sid="(awb-grid-[^"]+)"/g)].map(match => match[1])
  assert.equal(new Set(ids).size, ids.length, `${definition.componentId} must have unique grid identifiers`)
  assert.equal(html, render(), `${definition.componentId} static markup must be deterministic`)
  grids += ids.length
}
const manual = getComponent('ManualSection')
const html = renderToStaticMarkup(React.createElement(manual.render, { props: manual.propsSchema.parse(overrides.ManualSection), context: { staticRenderScope: 'manual-section', tokens: defaultTokens, baseUrl: '' } }))
assert.equal([...html.matchAll(/\sid="awb-grid-/g)].length, 2)
assert.ok(grids >= 8, 'Exercise all grid families')
console.log(`PASS: ${listComponents().length} static component layouts render without useId; ${grids} grids have stable, unique identifiers`)
