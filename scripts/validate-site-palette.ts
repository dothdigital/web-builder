import assert from 'node:assert/strict'
import { defaultTokens } from '@awb/component-registry'
import { paletteAlternatives } from '@awb/ai'
import type { WebsiteModel } from '@awb/website-model'
import { applySitePalette, restoreSitePalette, siteColors, replaceSiteColor } from '@awb/website-model'
import { rerunRequestSchema } from '@awb/shared/rerun-request'

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

const palette = paletteAlternatives(defaultTokens, ['#e23b73'])[0]!.tokens.palette
const applied = applySitePalette(model, palette)
const edited = structuredClone(applied)
edited.pages[0]!.sections[0]!.props.heading = 'Content edited after applying colours'
edited.globalComponents.header.props.logoImageUrl = '/replacement-logo.png'
const restored = restoreSitePalette(edited, model)
assert.deepEqual(restored.tokens, model.tokens)
assert.deepEqual(restored.pages[0]!.sections[0]!.props.elementColors, props.elementColors)
assert.equal(restored.pages[0]!.sections[0]!.props.heading, 'Content edited after applying colours')
assert.equal(restored.globalComponents.header.props.logoImageUrl, '/replacement-logo.png')
for (const scope of ['UPLOADS', 'IMAGES', 'FULL'] as const) {
  const request = rerunRequestSchema.parse({ scope, instruction: 'Update website', logoAssetId: 'logo', palette })
  assert.deepEqual(request.palette, palette)
}
assert.equal(rerunRequestSchema.safeParse({ scope: 'CONTENT', instruction: 'Rewrite', palette }).success, false)
assert.equal(rerunRequestSchema.safeParse({ scope: 'UPLOADS', imageAssetIds: ['photo'], palette }).success, false)
console.log('PASS: Revert restores theme and button overrides while retaining subsequent content/logo edits; palette survives every supported rerun scope.')

const customModel = structuredClone(model)
customModel.pages[1]!.sections[0]!.props.sectionBackgroundColor = '#aabbcc'
customModel.pages[0]!.sections[0]!.props.textColor = 'rgb(170, 187, 204)'
const colors = siteColors(customModel)
assert.ok(colors.includes('#aabbcc'))
assert.ok(colors.includes('#ff0000'))
assert.equal(colors.filter(color => color === '#ffffff').length, 1)
const replaced = replaceSiteColor(customModel, '#abc', '#123456')
assert.equal(replaced.pages[1]!.sections[0]!.props.sectionBackgroundColor, '#123456')
assert.equal(replaced.pages[0]!.sections[0]!.props.textColor, '#123456')
assert.equal(replaced.pages[0]!.sections[0]!.props.heading, '#ff0000')
console.log('PASS: site colour inventory includes custom colours, deduplicates equivalent colours and updates every matching style without rewriting content.')
