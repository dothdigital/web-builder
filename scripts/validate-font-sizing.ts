import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { getComponent, defaultTokens } from '@awb/component-registry'
Object.assign(globalThis, { React })
for (const componentId of ['HeroEditorial', 'AboutSplitOverlap', 'ServicesLargeNumbers']) {
  const definition = getComponent(componentId)!
  const props = definition.propsSchema.parse({ ...(definition.fixture as object), elementColors: { '/heading': { fontSize: 47, width: 45 } } })
  const html = renderToStaticMarkup(React.createElement(definition.render, { props, context: { tokens: defaultTokens, baseUrl: '' } }))
  assert.equal((html.match(/font-size:47px/g) ?? []).length, 1)
  assert.equal((html.match(/width:45%/g) ?? []).length, 1)
  assert.ok(html.includes('overflow-wrap:anywhere'))
  assert.ok(!definition.propsSchema.safeParse({ ...(definition.fixture as object), elementColors: { '/heading': { width: 101 } } }).success)
  assert.ok(!definition.propsSchema.safeParse({ ...(definition.fixture as object), elementColors: { '/heading': { fontSize: 300 } } }).success)
}
console.log('PASS: selected text font sizes persist and render independently; oversized values rejected.')
