import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { getComponent, defaultTokens } from '@awb/component-registry'
import { applyMultiAction } from '../apps/web/src/lib/multi-object-editing'
Object.assign(globalThis, { React })
const definition = getComponent('ManualSection')!
const paths = ['/items/0/text', '/items/1/imageUrl', '/items/2']
const initial = definition.propsSchema.parse({ items: [
  { id: 'text', kind: 'text', text: 'Spacing test' },
  { id: 'image', kind: 'image', imageUrl: 'https://example.com/photo.png' },
  { id: 'button', kind: 'button', label: 'Contact', href: '/contact' },
], elementColors: { [paths[0]]: { color: '#112233', marginLeft: 7 } } })
const sections = [{ id: 'spacing', componentId: 'ManualSection', props: initial }]
const value = { paddingTop: 11, paddingRight: 12, paddingBottom: 13, paddingLeft: 14, marginTop: 21, marginRight: 22, marginBottom: 23 }
const changed = applyMultiAction(sections as Parameters<typeof applyMultiAction>[0], 'spacing', { type: 'style', paths, value })
const saved = definition.propsSchema.parse(JSON.parse(JSON.stringify(changed[0]!.props)))
for (const path of paths) for (const [key, number] of Object.entries(value)) assert.equal((saved.elementColors as Record<string, Record<string, unknown>>)[path][key], number)
assert.equal((saved.elementColors as Record<string, Record<string, unknown>>)[paths[0]].marginLeft, 7)
assert.equal((initial.elementColors as Record<string, Record<string, unknown>>)[paths[0]].paddingTop, undefined)
const html = renderToStaticMarkup(React.createElement(definition.render, { props: saved, context: { tokens: defaultTokens, baseUrl: '/', staticRenderScope: 'spacing-test' } }))
for (const path of paths) {
 const tag = html.match(new RegExp('<[^>]*data-awb-element="' + path + '"[^>]*>'))?.[0]
 assert.ok(tag, path)
 for (const css of ['padding-top:11px', 'padding-right:12px', 'padding-bottom:13px', 'padding-left:14px', 'margin-top:21px', 'margin-right:22px', 'margin-bottom:23px']) assert.ok(tag.includes(css), path + ': ' + css)
}
console.log('PASS: multi-object spacing persists and renders on text, images and buttons; unrelated styles and source props are preserved.')
