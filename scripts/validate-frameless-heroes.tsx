import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { getComponent, defaultTokens } from '@awb/component-registry'
Object.assign(globalThis, { React })
for (const componentId of ['HeroEditorial', 'HeroTypographic', 'HeroSplitBooking']) {
 const definition = getComponent(componentId)!
 const render = (overrides: Record<string, unknown> = {}) => renderToStaticMarkup(React.createElement(definition.render, { props: definition.propsSchema.parse({ ...definition.fixture as object, imageUrl: '/portrait.png', ...overrides }), context: { tokens: defaultTokens } }))
 const plain = render()
 const img = plain.match(/<img[^>]*data-awb-element="\/imageUrl"[^>]*>/)?.[0]
 assert.ok(img, componentId)
 assert.match(img, /object-fit:contain/, componentId)
 assert.match(img, /aspect-ratio:auto/, componentId)
 const frame = plain.match(/<div[^>]*data-awb-image-container="\/imageUrl"[^>]*>/)?.[0]
 if (frame) for (const decoration of ['background:', 'box-shadow:', 'border:', 'border-radius:']) assert.ok(!frame.includes(decoration), `${componentId} unwanted frame ${decoration}`)
 assert.match(render({ imageSizes: { '/imageUrl': { fit: 'cover' } } }), /object-fit:cover/, 'Explicit image fit remains editable')
 assert.match(render({ imageLayout: 'background' }), /awb-native-background/, 'Background hero selection is preserved')
 if (componentId === 'HeroEditorial') {
  const moved = render({ freeElements: [{ id: 'moved', source: '/layout/0/0/1', componentId, content: { ...definition.fixture as object, imageUrl: '/portrait.png' }, x: 50, y: 50, width: 40, height: 550 }], removedElements: ['/layout/0/0/1'] })
  const movedImage = moved.match(/<img[^>]*data-awb-element="\/freeElements\/0\/content\/imageUrl"[^>]*>/)?.[0]
  assert.ok(movedImage)
  assert.match(movedImage, /object-fit:contain/)
  assert.ok(!moved.includes('box-shadow:'), 'Moved hero photo must not retain a template shadow')
 }
}
console.log('PASS: all shared split heroes are frameless and show full images by default; moved photo inherits the same behavior; explicit fit and background layout are preserved.')
