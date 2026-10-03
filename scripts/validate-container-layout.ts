import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { componentLayoutNodes, defaultTokens, findElement, getComponent, listComponents } from '@awb/component-registry'
import { editObjectProps, moveObject } from '../apps/web/src/lib/object-editing'
import type { WebsiteSection } from '@awb/website-model'
Object.assign(globalThis, { React })
for (const definition of listComponents()) {
  const fixture = definition.propsSchema.parse(definition.fixture) as Record<string, unknown>
  const nodes = componentLayoutNodes(definition.componentId, fixture)
  if (!nodes[0]) continue
  const path = nodes[0].path
  const props = definition.propsSchema.parse(editObjectProps(fixture, path, { type: 'style', value: { layoutColumns: 1, layoutGap: 32 } }))
  const tree = React.createElement(definition.render, { props, context: { tokens: defaultTokens, baseUrl: '' } })
  assert.match(renderToStaticMarkup(tree), /grid-template-columns:minmax\(0, 1fr\)/, definition.componentId)
}
const definition = getComponent('AboutSplitOverlap')!
const props = definition.propsSchema.parse({ ...definition.fixture as object, imageUrl: 'https://example.com/image.jpg', layout: 'steps', points: Array.from({ length: 4 }, (_, i) => ({ title: `Step ${i + 1}`, body: 'Details' })) }) as Record<string, unknown>
const nodes = componentLayoutNodes(definition.componentId, props)
const container = nodes[0]!.children[0]!
const image = container.children.find((entry) => entry.label === 'Image container')!
assert.ok(image)
let stacked = editObjectProps(props, container.path, { type: 'style', value: { layoutColumns: 1 } })
const render = (value: Record<string, unknown>) => (definition.render as (input: { props: unknown; context: import('@awb/component-registry').RenderContext }) => React.ReactNode)({ props: definition.propsSchema.parse(value), context: { tokens: defaultTokens, baseUrl: '' } })
assert.equal((findElement(render(stacked), container.path)?.props as { style: React.CSSProperties }).style.gridTemplateColumns, 'minmax(0, 1fr)')
stacked = editObjectProps(stacked, '/imageUrl', { type: 'delete' })
assert.equal((findElement(render(stacked), image.path)?.props as { style: React.CSSProperties }).style.display, 'none')
assert.match(renderToStaticMarkup(render(stacked)), /Step 4/)
const section: WebsiteSection = { id: 'story', componentId: definition.componentId, componentVersion: '1.0.0', hidden: false, props }
const detached = moveObject([section], section.id, image.path, section.id, { x: 0, y: 0, width: 100, height: 300 })!
assert.ok(detached)
assert.ok((detached.sections[0]!.props.flowSlots as Record<string, unknown>)[image.path], 'Original space is preserved')
const html = renderToStaticMarkup(render(detached.sections[0]!.props))
assert.match(html, /--free-width:100%|--free-w:100%|width:100%/)
assert.match(html, /image.jpg/)
assert.match(html, /Step 4/)
assert.equal((props.removedElements as string[]).length, 0, 'Undo source remains unchanged')
console.log('PASS: reusable container stacks across registry, image deletion clears frame, free image group detaches at section width and preserves original space and source history.')

import { imagePlacementAction } from '../apps/web/src/lib/image-placement'
const fake = (path: string, rect: { left: number; top: number; width: number; height: number }, attrs: string[] = [], parentElement: unknown = null) => ({ dataset: { awbElement: path }, getBoundingClientRect: () => rect, hasAttribute: (name: string) => attrs.includes(name), parentElement })
Object.assign(globalThis, { getComputedStyle: () => ({ marginTop: '0px', marginBottom: '0px', marginLeft: '0px', marginRight: '0px' }) })
const sectionDom = fake('', { left: 100, top: 100, width: 1200, height: 900 })
const freeDom = fake(detached.path, { left: 100, top: 100, width: 500, height: 300 }, ['data-awb-free-item'])
const frameDom = fake(`${detached.path}/content${image.path}`, { left: 100, top: 100, width: 500, height: 300 }, ['data-awb-image-container'], freeDom)
const imageDom = fake(`${detached.path}/content/imageUrl`, { left: 100, top: 100, width: 250, height: 300 }, [], frameDom)
const action = imagePlacementAction(imageDom as unknown as HTMLElement, sectionDom as unknown as HTMLElement, section.id, { width: 100, height: 400 })
assert.equal(action.type, 'move')
if (action.type === 'move') {
  assert.equal(action.sourcePath, detached.path, 'Selecting nested image resizes existing free frame')
  assert.deepEqual(action.placement, { x: 0, y: 0, width: 100, height: 400 })
  const resized = moveObject(detached.sections, section.id, action.sourcePath!, section.id, action.placement)!
  assert.equal((resized.sections[0]!.props.freeElements as unknown[]).length, 1, 'Resize does not duplicate detached image')
  assert.match(renderToStaticMarkup(render(resized.sections[0]!.props)), /--free-width:100%/)
}
console.log('PASS: image selected inside a free frame expands that frame to section width without duplicating it.')

import { resolveSectionMedia } from '../apps/web/src/lib/section-media'
import type { WebsiteModel, WebsitePage } from '@awb/website-model'
const fallbackUrl = 'https://example.com/canonical-fallback.jpg'
const emptySource = { ...section, props: { ...props, imageUrl: undefined } }
const mediaPage = { id: 'home', path: '/', title: 'Home', pageType: 'home', h1: 'Home', seo: { title: 'Home', description: 'Test', index: true }, sections: [{ ...section, id: 'hero-image', props: { imageUrl: fallbackUrl, imageAlt: 'Original concept' } }, emptySource] } as WebsitePage
const mediaModel = { pages: [mediaPage] } as WebsiteModel
const unresolvedMove = moveObject([emptySource], section.id, image.path, section.id, { x: 0, y: 0, width: 100, height: 300 })!
const resolvedMoveProps = resolveSectionMedia(mediaModel, mediaPage, unresolvedMove.sections[0]!)
assert.equal((resolvedMoveProps.freeElements as Array<{ content: Record<string, unknown> }>)[0]!.content.imageUrl, fallbackUrl, 'Previously detached snapshots recover page fallback')
assert.match(renderToStaticMarkup(render(resolvedMoveProps)), /src="https:\/\/example.com\/canonical-fallback.jpg"/)
const canonicalSource = { ...emptySource, props: resolveSectionMedia(mediaModel, mediaPage, emptySource) }
const captured = moveObject([canonicalSource], section.id, image.path, section.id, { x: 0, y: 0, width: 100, height: 300 })!
const snapshot = (captured.sections[0]!.props.freeElements as Array<{ content: Record<string, unknown> }>)[0]!.content
assert.equal(snapshot.imageUrl, fallbackUrl, 'New detach stores original canonical image')
assert.equal(emptySource.props.imageUrl, undefined, 'Source history is immutable')
const restored = JSON.parse(JSON.stringify(captured.sections[0]!.props))
assert.match(renderToStaticMarkup(render(restored)), /canonical-fallback.jpg/)
console.log('PASS: inherited image survives full-width detach, JSON save/reload, and old snapshots recover missing image references.')
const stripProps = { ...detached.sections[0]!.props, sectionBackgroundMode: 'colour', sectionBackgroundColor: '#fcd9ae', freeLayoutMinHeight: 0 }
const stripHtml = renderToStaticMarkup(render(stripProps))
assert.match(stripHtml, /data-awb-free-base="true" style="min-height:300px"/, 'Moved section ends at its content, with no automatic 24px strip')
assert.match(stripHtml, /awb-section-background>\.awb-section-content[^`]*min-height:inherit/, 'Custom background covers any retained section height')
console.log('PASS: moved section has no automatic trailing strip; custom background extends through reserved height.')
