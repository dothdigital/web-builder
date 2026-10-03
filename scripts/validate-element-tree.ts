import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { getComponent, defaultTokens, colorTargets } from '@awb/component-registry'
import { sectionElementTree } from '../apps/web/src/lib/element-tree'
Object.assign(globalThis, { React })
const definition = getComponent('AboutSplitOverlap')!
const props = definition.propsSchema.parse({ ...(definition.fixture as object), layout: 'steps', points: [{ title: 'First card', body: 'First description' }, { title: 'Second card', body: 'Second description' }], imageUrl: '/image.png', cta: { label: 'Contact', href: '/contact' }, elementColors: { '/points/1': { backgroundColor: '#abcdef' }, '/points/1/number': { color: '#123456' } } }) as Record<string, unknown>
const tree = sectionElementTree(definition.componentId, props)
const points = tree.find((node) => node.path === '/points')!
assert.equal(points.children.length, 2)
assert.ok(points.children[1]!.children.some((node) => node.path === '/points/1/number'))
assert.ok(points.children[1]!.children.some((node) => node.path === '/points/1/title'))
assert.ok(tree.find((node) => node.path === '/cta')?.children.some((node) => node.path === '/cta/label'))
assert.ok(colorTargets(definition.componentId, props).find((target) => target.path === '/points/1/number'))
const html = renderToStaticMarkup(React.createElement(definition.render, { props, context: { tokens: defaultTokens, baseUrl: '' } }))
for (const path of ['/heading', '/body', '/imageUrl', '/points/1', '/points/1/title', '/points/1/body', '/points/1/number', '/cta']) assert.ok(html.includes(`data-awb-element="${path}"`), `Missing canvas target ${path}`)
assert.equal((html.match(/color:#123456/g) ?? []).length, 1)
assert.ok(html.includes('background:#abcdef'))
console.log('PASS: nested story-card tree, number/title/body/image/button canvas targets and independent card/number colours.')
