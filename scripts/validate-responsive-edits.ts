import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { defaultTokens, getComponent } from '@awb/component-registry'
Object.assign(globalThis, { React })
const definition = getComponent('AboutSplitOverlap')!
const props = definition.propsSchema.parse({ ...definition.fixture as object, points: [{ title: 'Guidance', body: 'Helpful advice' }], sectionBackgroundMode: 'colour', sectionBackgroundColor: '#1f3151', elementOffsets: { '/points/0': { x: 144, y: 3 } }, elementColors: { '/points/0': { height: 241 }, '/layout/0/0': { height: 817 } }, freeElements: [{ id: 'image', componentId: definition.componentId, source: '/layout/0/0/0', content: definition.fixture, x: 3, y: 367, width: 44, height: 302 }] })
const before = JSON.stringify(props)
const html = renderToStaticMarkup(React.createElement(definition.render, { props, context: { tokens: defaultTokens, baseUrl: '' } }))
assert.equal(JSON.stringify(props), before, 'Responsive rendering never overwrites the redesign')
assert.match(html, /translate:144px 3px/, 'Desktop movement remains intact')
assert.match(html, /height:817px/, 'Desktop size remains intact')
assert.match(html, /--free-y:367px/, 'Desktop detached image retains its coordinates')
assert.match(html, /@container awb-edit-surface \(max-width:767px\)/)
assert.match(html, /data-awb-free-item\]\{position:relative!important/)
assert.match(html, /data-awb-flow-slot\]\{display:none!important/)
assert.match(html, /--awb-mobile-section-background:#1f3151/)
assert.match(html, /--awb-desktop-geometry:1/)
console.log('PASS: saved redesign retained; narrow-screen placement, fixed-height and slot fallbacks included in shared rendering.')
