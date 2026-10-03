import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { getComponent, defaultTokens, colorTargets, cardColor } from '@awb/component-registry'
import { reorderElementColors } from '../apps/web/src/lib/element-color-order'
Object.assign(globalThis, { React })
const render = (id: string, overrides: Record<string, unknown>) => {
  const definition = getComponent(id)!
  const props = definition.propsSchema.parse({ ...(definition.fixture as object), ...overrides })
  return renderToStaticMarkup(React.createElement(definition.render, { props, context: { tokens: defaultTokens, baseUrl: '' } }))
}
const items = [{ title: 'First', description: 'First copy' }, { title: 'Second', description: 'Second copy' }]
const colors = { '/items/0/title': { color: '#ff0000' }, '/items/0': { backgroundColor: '#123456', color: '#ffffff' }, '/heading': { color: '#00ff00' } }
for (const id of ['ServicesLargeNumbers', 'ServicesImageRail', 'ServicesAlternatingShowcase']) {
  const html = render(id, { items, elementColors: colors })
  assert.equal((html.match(/#ff0000/g) ?? []).length, 1, `${id}: only first title recoloured`)
  assert.equal((html.match(/#00ff00/g) ?? []).length, 1, `${id}: only section heading recoloured`)
  assert.ok(html.includes('background:#123456'))
}
for (const imageLayout of ['split', 'background']) {
  const html = render('HeroTypographic', { imageLayout, keywords: ['One', 'Two'], elementColors: { '/keywords/0': { color: '#abcdef', backgroundColor: '#123456' } } })
  assert.equal((html.match(/#abcdef/g) ?? []).length, 1)
}
const moved = reorderElementColors(colors, '/items', items, [items[1], items[0]])
assert.deepEqual(moved['/items/1/title'], colors['/items/0/title'])
assert.deepEqual(moved['/heading'], colors['/heading'])
assert.equal(reorderElementColors(colors, '/items', items, [items[1]])['/items/0/title'], undefined)
assert.equal(cardColor({}, '/items/0').color, 'var(--awb-card-fg, var(--awb-fg))')
assert.ok(colorTargets('AboutSplitOverlap', { points: [{ title: 'Approach', body: 'Our approach' }] }).some((target) => target.path === '/points/0/body'))
console.log('PASS: targeted text/card/chip colours render independently, card text stays separate from section text, and colours follow reordered cards.')
