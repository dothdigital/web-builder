import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { listComponents, emptyImagePointers, defaultTokens } from '@awb/component-registry'
Object.assign(globalThis, { React })
for (const definition of listComponents()) {
  const fixture = definition.fixture as Record<string, unknown>
  const render = (overrides: Record<string, unknown>) => renderToStaticMarkup(React.createElement(definition.render, { props: definition.propsSchema.parse({ ...fixture, ...overrides }), context: { tokens: defaultTokens, baseUrl: '' } }))
  const original = render({})
  assert.ok(!original.includes('class="awb-section-background"'))
  const colour = render({ sectionBackgroundMode: 'colour', sectionBackgroundColor: '#123456', sectionBackgroundImageUrl: '/unused.png' })
  assert.ok(colour.includes('background:#123456'))
  assert.ok(!colour.includes('src="/unused.png"'))
  const image = render({ sectionBackgroundMode: 'image', sectionBackgroundImageUrl: '/background.png', sectionBackgroundOpacity: 0, sectionBackgroundBlend: 'multiply' })
  assert.ok(image.includes('src="/background.png"'))
  assert.ok(image.includes('opacity:0'))
  assert.ok(image.includes('mix-blend-mode:multiply'))
  assert.ok(!emptyImagePointers(definition.componentId, {}).includes('/sectionBackgroundImageUrl'))
  assert.ok(!definition.propsSchema.safeParse({ ...fixture, sectionBackgroundOpacity: 101 }).success)
  assert.ok(!definition.propsSchema.safeParse({ ...fixture, sectionBackgroundColor: 'invalid' }).success)
}
console.log(`PASS: all ${listComponents().length} components support original, colour and image backgrounds; legacy defaults, opacity bounds and optional AI slots verified.`)
