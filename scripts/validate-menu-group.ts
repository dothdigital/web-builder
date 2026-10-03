import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { getComponent, defaultTokens, colorTargets } from '@awb/component-registry'
import { sectionElementTree } from '../apps/web/src/lib/element-tree'
Object.assign(globalThis, { React })
for (const id of ['HeaderTransparent', 'HeaderSplitUtility']) {
  const definition = getComponent(id)!
  for (const menuAlignment of ['original', 'left', 'right']) {
    const props = definition.propsSchema.parse({ ...definition.fixture as object, menuAlignment, items: [{ label: 'Services', href: '/services', children: [{ label: 'Strategy', href: '/strategy' }] }, { label: 'About', href: '/about', children: [] }], elementColors: { '/items': { color: '#123456', fontFamily: 'Georgia, serif', fontSize: 23, fontWeight: 700, fontStyle: 'italic' }, '/items/0/label': { color: '#ff0000', fontSize: 12 }, '/logoText': { color: '#abcdef' } } }) as Record<string, unknown>
    const html = renderToStaticMarkup(React.createElement(definition.render, { props, context: { tokens: defaultTokens, baseUrl: '' } }))
    assert.match(html, /data-awb-element="\/items" data-awb-menu="true"/)
    const labels = [...html.matchAll(/<span data-awb-element="\/items\/[^\"]+" style="([^\"]+)"/g)]
    assert.ok(labels.length >= 4, 'Top-level, overview and submenu labels rendered')
    for (const [, style] of labels) {
      assert.match(style!, /color:#123456/)
      assert.match(style!, /font-family:Georgia, serif/)
      assert.match(style!, /font-size:23px/)
      assert.match(style!, /font-weight:700/)
      assert.match(style!, /font-style:italic/)
    }
    assert.match(html, /data-awb-element="\/logoText" style="color:#abcdef"/)
    assert.ok(colorTargets(id, props).some((target) => target.path === '/items'))
    assert.ok(sectionElementTree(id, props).some((target) => target.path === '/items' && target.children.length === 2))
    definition.propsSchema.parse(JSON.parse(JSON.stringify(props)))
  }
}
console.log('PASS: whole-menu typography and colour across header variants, split menus, dropdowns, prior per-link overrides, sidebar selection, saved props, and unchanged logo styling.')
for (const id of ['HeaderTransparent', 'HeaderSplitUtility']) {
  const definition = getComponent(id)!
  for (const [logoAlignment, column, alignment] of [['left', 1, 'start'], ['center', 2, 'center'], ['right', 3, 'end']] as const) {
    const props = definition.propsSchema.parse({ ...definition.fixture as object, logoAlignment, logoImageUrl: 'https://example.com/logo.png', imageSizes: { '/logoImageUrl': { position: 'center' } } })
    const html = renderToStaticMarkup(React.createElement(definition.render, { props, context: { tokens: defaultTokens, baseUrl: '' } }))
    assert.ok(html.includes(`grid-column:${column};grid-row:1;justify-self:${alignment}`), `${id}: ${logoAlignment} moves logo anchor, regardless of image focus`)
    assert.match(html, /data-awb-element="\/logoImageUrl"/)
  }
}
console.log('PASS: left/centre/right logo positioning is independent of image focus for both header variants.')
