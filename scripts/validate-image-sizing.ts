import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { defaultTokens, getComponent } from '@awb/component-registry'
import { imageSizing, imageSizesSchema } from '../packages/component-registry/src/image-sizing'
Object.assign(globalThis, { React })
const sizes = { '/imageUrl': { width: 65, height: 320, fit: 'contain', position: 'top' } }
assert.ok(imageSizesSchema.safeParse(sizes).success)
assert.ok(!imageSizesSchema.safeParse({ '/imageUrl': { width: 101 } }).success)
assert.equal(imageSizing({ imageSizes: sizes }, '/imageUrl').width, '65%')
assert.equal(imageSizing({ imageSizes: sizes }, '/imageUrl', true).width, undefined)
assert.equal(imageSizing({ imageSizes: sizes }, '/imageUrl', true).height, undefined)
for (const id of ['AboutSplitOverlap', 'HeroEditorial', 'HeroTypographic', 'ContactSplit']) {
  const definition = getComponent(id)!
  const props = definition.propsSchema.parse({ ...(definition.fixture as object), imageUrl: '/test.png', imageSizes: sizes })
  const html = renderToStaticMarkup(React.createElement(definition.render, { props, context: { tokens: defaultTokens, baseUrl: '' } }))
  assert.ok(html.includes('width:65%'), `${id} width`)
  assert.ok(html.includes('height:320px'), `${id} height`)
  assert.ok(html.includes('object-fit:contain'), `${id} fit`)
}
console.log('PASS: image dimensions and fit render in story, hero and contact sections; background dimensions stay full-bleed; invalid widths rejected.')

const story = getComponent('AboutSplitOverlap')!
const resized = story.propsSchema.parse({ ...(story.fixture as object), imageUrl: '/test.png', imageSizes: sizes, elementColors: { '/layout/0/0/0': { width: 100, height: 600 } } })
const resizedHtml = renderToStaticMarkup(React.createElement(story.render, { props: resized, context: { tokens: defaultTokens, baseUrl: '' } }))
const container = resizedHtml.match(/<div(?=[^>]*data-awb-image-container="\/imageUrl")[^>]*>/)?.[0]
const img = resizedHtml.match(/<img(?=[^>]*data-awb-element="\/imageUrl")[^>]*>/)?.[0]
assert.ok(container && img)
assert.match(container, /width:65%/)
assert.match(container, /height:auto/)
assert.ok(!container.includes('height:600px'), 'Image resize releases the old container height')
assert.match(container, /border-radius:18px/)
assert.match(img, /width:100%/)
assert.match(img, /height:320px/)
assert.ok(!img.includes('width:65%'), 'Width is applied once to the container, not twice to image and parent')
console.log('PASS: dedicated image containers follow image width and height, keep their border/shadow, and release old empty space.')

const movedProps = story.propsSchema.parse({ ...(story.fixture as object), imageUrl: '/test.png', imageSizes: sizes, elementOffsets: { '/imageUrl': { x: 40, y: 30 }, '/layout/0/0/0': { x: 5, y: 10 } } })
const movedHtml = renderToStaticMarkup(React.createElement(story.render, { props: movedProps, context: { tokens: defaultTokens, baseUrl: '' } }))
const movedContainer = movedHtml.match(/<div(?=[^>]*data-awb-image-container="\/imageUrl")[^>]*>/)?.[0]
const movedImg = movedHtml.match(/<img(?=[^>]*data-awb-element="\/imageUrl")[^>]*>/)?.[0]
assert.ok(movedContainer && movedImg)
assert.match(movedContainer, /translate:45px 40px/)
assert.ok(!movedImg.includes('translate:'), 'Image and frame receive one combined translation, never two')
assert.match(movedContainer, /border-radius:18px/)
console.log('PASS: image movement carries its container border and shadow; existing image and parent offsets combine without double movement.')
