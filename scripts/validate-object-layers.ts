import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { getComponent, defaultTokens, componentLayoutNodes } from '@awb/component-registry'
import { editObjectProps, moveObject } from '../apps/web/src/lib/object-editing'
import type { WebsiteSection } from '@awb/website-model'
Object.assign(globalThis, { React })
const definition = getComponent('AboutSplitOverlap')!
const section: WebsiteSection = { id: 'story', componentId: definition.componentId, componentVersion: '1.0.0', hidden: false, props: { ...definition.fixture as object, imageUrl: 'https://example.com/image.png' } }
const imagePath = componentLayoutNodes(section.componentId, section.props)[0]!.children[0]!.children.find((entry) => entry.label === 'Image container')!.path
let props = editObjectProps(section.props, '/imageUrl', { type: 'layer', sourcePath: imagePath, direction: 'front' })
assert.equal((props.elementColors as Record<string, { zIndex: number }>)[imagePath]!.zIndex, 3)
props = editObjectProps(props, imagePath, { type: 'layer', direction: 'back' })
let html = renderToStaticMarkup(React.createElement(definition.render, { props: definition.propsSchema.parse(props), context: { tokens: defaultTokens, baseUrl: '' } }))
assert.match(html, /z-index:0/)
assert.match(html, /image.png/)
const first = moveObject([section], section.id, imagePath, section.id, { x: 0, y: 0, width: 50, height: 200 })!
const second = moveObject(first.sections, section.id, '/heading', section.id, { x: 0, y: 0, width: 50, height: 100 })!
const original = JSON.stringify(second.sections[0]!.props)
props = editObjectProps(second.sections[0]!.props, '/freeElements/0', { type: 'layer', direction: 'front' })
let free = props.freeElements as Array<{ zIndex: number }>
assert.ok(free[0]!.zIndex > free[1]!.zIndex)
props = editObjectProps(props, '/freeElements/0', { type: 'layer', direction: 'backward' })
free = props.freeElements as Array<{ zIndex: number }>
assert.ok(free[0]!.zIndex < free[1]!.zIndex)
html = renderToStaticMarkup(React.createElement(definition.render, { props: definition.propsSchema.parse(JSON.parse(JSON.stringify(props))), context: { tokens: defaultTokens, baseUrl: '' } }))
assert.match(html, /data-awb-element="\/freeElements\/0" style="z-index:1/)
assert.match(html, /data-awb-element="\/freeElements\/1" style="z-index:2/)
assert.equal(JSON.stringify(second.sections[0]!.props), original)
const reset = editObjectProps(props, '/freeElements/0', { type: 'layer', direction: 'reset' })
assert.equal((reset.freeElements as Array<{ zIndex?: number }>)[0]!.zIndex, undefined)
console.log('PASS: image/frame native ordering, detached front/backward ordering, saved renderer layer styles, reset, and immutable undo source.')
