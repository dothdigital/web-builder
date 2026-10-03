import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { getComponent, defaultTokens } from '@awb/component-registry'
Object.assign(globalThis, { React })
const definition = getComponent('ReviewsTrustStrip')!
const Component = definition.render
const testimonials = [{ author: 'First Client', quote: 'My actual review.', source: 'Google' }, { author: 'Second Client', quote: 'Another real review.' }]
for (const layout of ['cards', 'slider']) {
  const props = definition.propsSchema.parse({ layout, testimonials })
  const html = renderToStaticMarkup(React.createElement(Component, { props, context: { tokens: defaultTokens, baseUrl: '' } }))
  assert.ok(html.includes('My actual review.'))
  assert.ok(html.includes('Another real review.'))
  assert.equal(html.includes('aria-roledescription="carousel"'), layout === 'slider')
  assert.equal(html.includes('scroll-snap-type:x mandatory'), layout === 'slider')
  assert.ok(!html.includes('/5'), 'Do not invent star ratings')
}
console.log('PASS: testimonial cards, scroll-snap slider, exact supplied reviews and no fabricated ratings')
