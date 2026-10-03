import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { getComponent, defaultTokens } from '@awb/component-registry'
import type { WebsiteSection } from '@awb/website-model'
import { applyMultiAction } from '../apps/web/src/lib/multi-object-editing'
Object.assign(globalThis, { React })
const definition = getComponent('AboutSplitOverlap')!
const source: WebsiteSection = { id: 'story', componentId: definition.componentId, componentVersion: '1.0.0', hidden: false, props: definition.propsSchema.parse(definition.fixture) as Record<string, unknown> }
const original = JSON.stringify(source)
const paths = ['/heading', '/body']
const grouped = applyMultiAction([source], source.id, { type: 'group', paths })
const saved = definition.propsSchema.parse(JSON.parse(JSON.stringify(grouped[0]!.props))) as Record<string, unknown>
assert.deepEqual((saved.elementGroups as Array<{ paths: string[] }>)[0]!.paths, paths)
const styled = applyMultiAction(grouped, source.id, { type: 'style', paths, value: { color: '#aabbcc', fontSize: 28, fontStyle: 'italic' } })
for (const path of paths) assert.deepEqual((styled[0]!.props.elementColors as Record<string, unknown>)[path], { color: '#aabbcc', fontSize: 28, fontStyle: 'italic' })
const moved = applyMultiAction(styled, source.id, { type: 'move', items: paths.map((path) => ({ path, placement: { x: 10, y: 40, width: 30, height: 80 }, offset: { x: 24, y: 12, sectionWidth: 1200 } })) })
for (const path of paths) assert.deepEqual((moved[0]!.props.elementOffsets as Record<string, unknown>)[path], { x: 24, y: 12 })
const html = renderToStaticMarkup(React.createElement(definition.render, { props: definition.propsSchema.parse(moved[0]!.props), context: { tokens: defaultTokens, baseUrl: '' } }))
assert.equal((html.match(/translate:24px 12px/g) ?? []).length, 2)
assert.equal((html.match(/color:#aabbcc/g) ?? []).length, 2)
const ungrouped = applyMultiAction(moved, source.id, { type: 'ungroup', paths })
assert.deepEqual(ungrouped[0]!.props.elementGroups, [])
assert.deepEqual(ungrouped[0]!.props.elementOffsets, moved[0]!.props.elementOffsets)
const deleted = applyMultiAction(moved, source.id, { type: 'delete', paths })
assert.deepEqual(deleted[0]!.props.removedElements, paths)
assert.deepEqual(deleted[0]!.props.elementGroups, [])
assert.equal(JSON.stringify(source), original, 'Undo source remains immutable')
console.log('PASS: multi-style edits, saved groups, shared offsets in renderer, ungroup preserves positions, batch deletion, and immutable undo snapshots.')

import { alignSelection } from '../apps/web/src/lib/multi-object-editing'
const boxes = [
  { path: 'a', x: 0, y: 0, width: 100, height: 30 },
  { path: 'b', x: 130, y: 70, width: 60, height: 50 },
  { path: 'c', x: 260, y: 180, width: 40, height: 20 },
]
const horizontal = alignSelection(boxes, 'horizontal')
assert.equal(horizontal[1]!.x - horizontal[0]!.x - horizontal[0]!.width, horizontal[2]!.x - horizontal[1]!.x - horizontal[1]!.width)
const vertical = alignSelection(boxes, 'vertical')
assert.equal(vertical[1]!.y - vertical[0]!.y - vertical[0]!.height, vertical[2]!.y - vertical[1]!.y - vertical[1]!.height)
assert.ok(alignSelection(boxes, 'left').every((box) => box.x === 0))
assert.ok(alignSelection(boxes, 'middle').every((box) => box.y + box.height / 2 === 100))
assert.equal(boxes[1]!.x, 130, 'Alignment does not mutate source geometry')
const resized = applyMultiAction(grouped, source.id, { type: 'resize', items: paths.map((path, index) => ({ path, scale: .5, placement: { x: 10, y: 20 + index * 50, width: 25, height: 40 }, slot: { width: 600, height: 80, display: 'block' as const, marginTop: 0, marginBottom: 0, marginLeft: 0, marginRight: 0 } })) })
const scaledProps = definition.propsSchema.parse(JSON.parse(JSON.stringify(resized[0]!.props))) as Record<string, unknown>
assert.deepEqual((scaledProps.elementGroups as Array<{ paths: string[] }>)[0]!.paths, ['/freeElements/0', '/freeElements/1'])
assert.ok((scaledProps.freeElements as Array<{ contentScale: number }>).every((entry) => entry.contentScale === .5))
const scaledHtml = renderToStaticMarkup(React.createElement(definition.render, { props: scaledProps, context: { tokens: defaultTokens, baseUrl: '' } }))
assert.equal((scaledHtml.match(/--free-scale:0.5/g) ?? []).length, 2)
assert.match(scaledHtml, /transform:scale\(var\(--free-scale,1\)\)/)
const twice = applyMultiAction(resized, source.id, { type: 'resize', items: ['/freeElements/0', '/freeElements/1'].map((path, index) => ({ path, scale: 2, placement: { x: 10, y: 20 + index * 100, width: 50, height: 80 }, slot: { width: 300, height: 40, display: 'block' as const, marginTop: 0, marginBottom: 0, marginLeft: 0, marginRight: 0 } })) })
const free = twice[0]!.props.freeElements as Array<{ contentScale: number }>
assert.equal(free.length, 2)
assert.ok(free.every((entry) => entry.contentScale === 1))
console.log('PASS: equal gaps with unequal box sizes, edge/centre alignment, proportional content scaling, group path remapping, and repeat resize without duplication.')
