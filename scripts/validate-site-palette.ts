import assert from 'node:assert/strict'
import { defaultTokens } from '@awb/component-registry'
import { paletteAlternatives } from '@awb/ai'
import type { WebsiteModel } from '@awb/website-model'
import { applySitePalette } from '../apps/web/src/lib/site-palette'

const props = { heading: '#ff0000', logoImageUrl: '/logo.svg', sectionBackgroundMode: 'image', sectionBackgroundImageUrl: '/photo.jpg', sectionBackgroundColor: '#ffffff', sectionBackgroundTextColor: '#102a43', elementColors: { '/cta': { backgroundColor: '#14110f', color: '#ffffff', paddingTop: 28 } } }
const section = { id: 'section', componentId: 'HeroTypographic', props }
const model = { tokens: { ...defaultTokens, buttons: { background: '#ff0000', text: '#ffffff', outline: '#ff0000' } }, globalComponents: { header: section, footer: section }, pages: [{ id: 'one', sections: [section] }, { id: 'two', sections: [section] }] } as unknown as WebsiteModel
const snapshot = JSON.stringify(model)
for (const suggestion of paletteAlternatives(defaultTokens, ['#e23b73', '#289872'])) {
  const next = applySitePalette(model, suggestion.tokens.palette)
  assert.deepEqual(next.tokens.palette, suggestion.tokens.palette)
  assert.deepEqual(next.tokens.typography, model.tokens.typography)
  assert.equal(next.tokens.buttons, undefined)
  for (const component of [next.globalComponents.header, next.globalComponents.footer, ...next.pages.flatMap(page => page.sections)]) {
    assert.equal(component.props.heading, props.heading)
    assert.equal(component.props.logoImageUrl, props.logoImageUrl)
    assert.equal(component.props.sectionBackgroundImageUrl, props.sectionBackgroundImageUrl)
    assert.equal(component.props.sectionBackgroundMode, 'image')
    const styles = component.props.elementColors as typeof props.elementColors
    assert.equal(styles['/cta'].paddingTop, 28)
    assert.ok(Object.values(suggestion.tokens.palette).includes(styles['/cta'].backgroundColor))
    assert.notEqual(styles['/cta'].color, styles['/cta'].backgroundColor)
  }
}
assert.equal(JSON.stringify(model), snapshot, 'Original snapshot must remain intact for Undo')
console.log('PASS: palettes cover every page and global component, preserve content/layout/images, reset buttons and leave the original snapshot intact.')
