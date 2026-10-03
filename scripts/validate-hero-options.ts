import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { getComponent, defaultTokens, emptyImagePointers } from '@awb/component-registry'
Object.assign(globalThis, { React })
for (const id of ['HeroEditorial', 'HeroSplitBooking', 'HeroTypographic']) {
  const definition = getComponent(id)!
  const legacy = definition.propsSchema.parse({ heading: 'A clear introduction' }) as Record<string, unknown>
  assert.equal(legacy.imageLayout, 'split')
  for (const opacity of [0, 60, 100]) {
    const props = definition.propsSchema.parse({ ...(definition.fixture as Record<string, unknown>), imageLayout: 'background', imageUrl: '/image.png', overlayOpacity: opacity, imageBlend: 'multiply' })
    const html = renderToStaticMarkup(React.createElement(definition.render, { props, context: { tokens: defaultTokens, baseUrl: '' } }))
    assert.equal((html.match(/<h1/g) ?? []).length, 1)
    assert.ok(html.includes('src="/image.png"'))
    assert.ok(html.includes(`opacity:${opacity / 100}`))
    assert.ok(html.includes('mix-blend-mode:multiply'))
  }
  assert.equal(definition.propsSchema.safeParse({ heading: 'Title', overlayOpacity: 101 }).success, false)
}
const contact = getComponent('ContactSplit')!
assert.ok(emptyImagePointers('ContactSplit', contact.fixture).includes('/imageUrl'))
for (const imageUrl of ['', '/contact.png']) {
  const html = renderToStaticMarkup(React.createElement(contact.render, { props: contact.propsSchema.parse({ ...(contact.fixture as Record<string, unknown>), imageUrl }), context: { tokens: defaultTokens, baseUrl: '' } }))
  assert.ok(html.includes('<form'))
  assert.equal(html.includes('src="/contact.png"'), !!imageUrl)
  assert.ok(html.includes('linear-gradient'))
}
console.log('PASS: all heroes retain split defaults, background images, blend and opacity limits; contact image and branded fallback render.')
