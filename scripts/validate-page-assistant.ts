import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { JSDOM } from 'jsdom'
Object.assign(globalThis, { React })
import assert from 'node:assert/strict'
import { websiteModelSchema } from '@awb/website-model'
import { defaultTokens, getComponent } from '@awb/component-registry'
import { assistantPlanSchema } from '@awb/ai/editor-command'
import { assistantTargets, resolveAssistantPlan, applyAssistantPlan, editorCompatiblePlan } from '../apps/web/src/lib/page-assistant'
const chrome = (id: string) => ({ componentId: id, componentVersion: '1.0.0', props: getComponent(id)!.fixture })
const model = websiteModelSchema.parse({ schemaVersion: '1.0.0', site: { name: 'Example', previewHost: 'example.test' }, businessProfileRef: 'test', tokens: defaultTokens, designDna: { direction: 'corporate', composition: { symmetry: 'symmetric', density: 'balanced', width: 'wide', rhythm: 'modular' }, typography: { headingStyle: 'geometric-sans', bodyStyle: 'clean-sans', scale: 'standard' }, imagery: { style: 'documentary', dominance: 'medium', treatment: 'natural' }, navigation: 'split-nav', motion: 'none', corners: 'soft', ctaStyle: 'solid', colorBehavior: 'tonal' }, navigation: { primaryMenu: [] }, globalComponents: { header: chrome('HeaderSplitUtility'), footer: chrome('FooterCompact') }, pages: [{ id: 'home', path: '/', title: 'Home', h1: 'Home', seo: { title: 'Home', description: 'Useful advice from our business.' }, sections: [{ id: 'hero', componentId: 'HeroTypographic', props: { ...(getComponent('HeroTypographic')!.fixture as object), secondaryCta: { label: 'Learn more', href: '/about' } } }, { id: 'manual', componentId: 'ManualSection', props: { items: [] } }] }, { id: 'about', path: '/about', title: 'About', h1: 'About', seo: { title: 'About', description: 'About our company and services.' }, sections: [] }] })
const original = JSON.stringify(model)
const plan = (action: string, target: object, value: unknown, property = '') => assistantPlanSchema.parse({ kind: 'edit', message: 'Proposed edit', operations: [{ action, target, property, valueJson: JSON.stringify(value) }] })
const generic = plan('style', { kind: 'button' }, { backgroundColor: '#123456' })
const ambiguous = resolveAssistantPlan(model, 'home', generic)
assert.ok(ambiguous.question && ambiguous.question.choices.length >= 2, 'Generic button requests must ask which button')
assert.throws(() => applyAssistantPlan(model, 'home', generic), /Which one/)
const first = ambiguous.question!.choices[0]!
const changed = applyAssistantPlan(model, 'home', generic, undefined, { 0: [first.id] })
assert.equal((changed.pages[0]!.sections[0]!.props.elementColors as Record<string, { backgroundColor: string }>)[first.path]!.backgroundColor, '#123456')
assert.deepEqual(changed.pages[1], model.pages[1], 'Other pages remain unchanged')
assert.deepEqual(changed.globalComponents, model.globalComponents)
assert.equal(JSON.stringify(model), original, 'Original remains available for Undo')
const heading = String(model.pages[0]!.sections[0]!.props.heading)
const text = applyAssistantPlan(model, 'home', plan('text', { kind: 'text', section: 'hero', text: heading }, 'A new heading'))
assert.equal(text.pages[0]!.sections[0]!.props.heading, 'A new heading')
for (const raw of ['Licensed advisors. Clear guidance.', 'First line\nSecond line', '2026', 'true', '']) {
  const plain = plan('text', { kind: 'text', section: 'hero', text: heading }, '')
  plain.operations[0]!.valueJson = raw
  assert.equal(applyAssistantPlan(model, 'home', plain).pages[0]!.sections[0]!.props.heading, raw)
}
const badStyle = plan('style', { kind: 'button', all: true }, {})
badStyle.operations[0]!.valueJson = 'backgroundColor: blue'
assert.throws(() => applyAssistantPlan(model, 'home', badStyle), /unsupported format/)
const brokenText = plan('text', { kind: 'text', section: 'hero', text: heading }, '')
brokenText.operations[0]!.valueJson = '{"heading":'
assert.throws(() => applyAssistantPlan(model, 'home', brokenText), /unsupported format/)
const unsafeLink = plan('link', { kind: 'button', section: 'hero', text: 'Learn more' }, '')
unsafeLink.operations[0]!.valueJson = 'javascript:alert(1)'
assert.throws(() => applyAssistantPlan(model, 'home', unsafeLink), /valid image or page link/)
// Actual worker response: a text target identifies /heading and also names it.
for (const action of ['text', 'set']) {
  const result = applyAssistantPlan(model, 'home', plan(action, { kind: 'text', section: 'hero', text: heading }, 'Protect what matters. Build for what’s next.', '/heading'))
  assert.equal(result.pages[0]!.sections[0]!.props.heading, 'Protect what matters. Build for what’s next.')
  assert.deepEqual(result.pages[0]!.sections[0]!.props.primaryCta, model.pages[0]!.sections[0]!.props.primaryCta)
}
const sectionText = applyAssistantPlan(model, 'home', plan('text', { kind: 'section', section: 'hero' }, 'Section headline', '/heading'))
assert.equal(sectionText.pages[0]!.sections[0]!.props.heading, 'Section headline')
assert.throws(() => applyAssistantPlan(model, 'home', plan('text', { kind: 'text', section: 'hero', text: heading }, 'Wrong field', '/body')), /does not contain/)
assert.throws(() => applyAssistantPlan(model, 'home', plan('set', { kind: 'section', section: 'hero' }, { heading: 'Invalid wrapper' }, '/heading')), /No changes were applied/)
const selected = applyAssistantPlan(model, 'home', plan('style', { kind: 'button', useSelection: true }, { fontSize: 24 }), { scope: 'page', sectionId: 'hero', paths: [first.path] })
assert.equal((selected.pages[0]!.sections[0]!.props.elementColors as Record<string, { fontSize: number }>)[first.path]!.fontSize, 24)
const all = applyAssistantPlan(model, 'home', plan('style', { kind: 'button', all: true }, { color: '#abcdef' }))
assert.ok(Object.keys(all.pages[0]!.sections[0]!.props.elementColors as object).length >= 2)
const add = applyAssistantPlan(model, 'home', plan('addObject', { kind: 'section', section: 'last' }, { kind: 'form', props: {} }))
assert.equal((add.pages[0]!.sections[1]!.props.items as Array<{ kind: string }>)[0]!.kind, 'form')
const deletion = plan('delete', { kind: 'section', section: 'hero' }, null)
assert.throws(() => applyAssistantPlan(model, 'home', deletion), /confirm/)
assert.equal(applyAssistantPlan(model, 'home', deletion, undefined, {}, true).pages[0]!.sections.length, 1)
const shared = plan('style', { scope: 'header', kind: 'section' }, { color: '#112233' })
assert.throws(() => applyAssistantPlan(model, 'home', shared), /confirm/)
assert.deepEqual(applyAssistantPlan(model, 'home', shared, undefined, {}, true).pages, model.pages)
for (const property of ['/__proto__/polluted', '/javascript', '/submissionUrl']) assert.throws(() => applyAssistantPlan(model, 'home', plan('set', { kind: 'section', section: 'hero' }, 'bad', property)))
assert.throws(() => applyAssistantPlan(model, 'home', plan('link', { kind: 'button', all: true }, 'javascript:alert(1)')))
const invalid = plan('style', { kind: 'button', all: true }, { fontSize: 999 })
assert.throws(() => applyAssistantPlan(model, 'home', invalid))
assert.equal(JSON.stringify(model), original)
assert.ok(assistantTargets(model, 'home').every(target => target.scope !== 'page' || ['hero', 'manual'].includes(target.sectionId)))
const manualModel = structuredClone(model)
const manual = manualModel.pages[0]!.sections[1]!
manual.props = getComponent('ManualSection')!.propsSchema.parse({ items: [
  { id: 'heading', kind: 'heading', text: 'Licensed guidance' },
  { id: 'image', kind: 'image', imageUrl: '/photo.png' },
  { id: 'cta', kind: 'button', label: 'Discuss your goals', href: '/contact', formFields: [] },
] }) as Record<string, unknown>
const catalogue = assistantTargets(manualModel, 'home')
assert.equal(catalogue.find(target => target.sectionId === 'manual' && target.path === '/items/2')?.kind, 'button')
assert.ok(!catalogue.some(target => target.sectionId === 'manual' && target.path.includes('/items/1') && target.kind === 'button'), 'Image defaults must not classify it as a button')
const themePlan = plan('themeButton', { kind: 'button', section: 'Licensed guidance', text: 'Discuss your goals' }, null)
manualModel.tokens.buttons = { background: '#abcdef', text: '#123456', outline: '#123456' }
const themed = applyAssistantPlan(manualModel, 'home', themePlan)
const compatible = editorCompatiblePlan(themePlan, manualModel)
assert.equal(compatible.operations[0]!.action, 'style', 'Server sends a command older editor tabs understand')
assert.equal(themePlan.operations[0]!.action, 'themeButton', 'Saved AI reply remains unchanged')
assert.deepEqual(applyAssistantPlan(manualModel, 'home', compatible), themed, 'Compatible reply produces identical colours and targeting')
assert.deepEqual((themed.pages[0]!.sections[1]!.props.elementColors as Record<string, unknown>)['/items/2'], { backgroundColor: '#abcdef', color: '#123456', borderColor: '#abcdef' })
assert.deepEqual(themed.pages[0]!.sections[0], manualModel.pages[0]!.sections[0], 'Theme edit must not affect other buttons')
assert.deepEqual(themed.pages[0]!.sections[1]!.props.items, manual.props.items, 'Theme styling preserves text, links and images')
const withImage = applyAssistantPlan(manualModel, 'home', plan('addObject', { kind: 'section', useSelection: true }, { kind: 'image', props: { imageUrl: '/existing-project-image.png', imageAlt: 'Relevant image' } }), { scope: 'page', sectionId: 'manual', paths: ['/items/2'] })
assert.equal((withImage.pages[0]!.sections[1]!.props.items as Array<{ imageUrl: string }>).at(-1)!.imageUrl, '/existing-project-image.png')
assert.deepEqual(withImage.pages[0]!.sections[0], manualModel.pages[0]!.sections[0], 'Add image uses the containing selected section only')
assert.throws(() => applyAssistantPlan(manualModel, 'home', plan('themeButton', { kind: 'button', useSelection: true }, null), { scope: 'page', sectionId: 'manual', paths: ['/items/1/imageUrl'] }), /could not find/, 'Incompatible selection must not fall back to another button')
delete manualModel.tokens.buttons
const inherited = applyAssistantPlan(manualModel, 'home', themePlan)
assert.equal((inherited.pages[0]!.sections[1]!.props.elementColors as Record<string, { backgroundColor: string }>)['/items/2']!.backgroundColor, manualModel.tokens.palette.primary)
console.log('PASS: manual button classification, image isolation, named sections, exact theme colours and no unrelated-selection fallback.')
console.log('PASS: ambiguity, selected target, bulk edits, manual forms, confirmations, page isolation, immutable Undo, schema validation and unsafe action rejection.')

for (const componentId of ['HeaderTransparent', 'HeaderSplitUtility']) {
  const headerModel = structuredClone(model)
  const definition = getComponent(componentId)!
  headerModel.globalComponents.header = { componentId, componentVersion: '1.0.0', props: definition.propsSchema.parse({ ...definition.fixture as object, items: [
    { label: 'Services', href: '/services', children: [{ label: 'Strategy', href: '/strategy' }] },
    { label: 'About', href: '/about', children: [] },
  ] }) as Record<string, unknown> }
  const header = { scope: 'header', kind: 'section' }
  const catalogue = assistantTargets(headerModel, 'home')
  assert.ok(catalogue.find(target => target.scope === 'header' && target.kind === 'section')?.editableFields?.some(field => field.path === '/menuAlignment'))
  const background = plan('set', header, '#123456', '/backgroundColor')
  assert.throws(() => applyAssistantPlan(headerModel, 'home', background), /confirm/)
  let edited = applyAssistantPlan(headerModel, 'home', background, undefined, {}, true)
  assert.equal(edited.globalComponents.header!.props.customBackground, true)
  const groupStyle = { color: '#abcdef', fontFamily: 'Georgia, serif', fontSize: 23, fontWeight: 700, fontStyle: 'italic' }
  const menu = plan('style', { scope: 'header', kind: 'element', text: 'Navigation menu (all links)' }, groupStyle)
  assert.equal(resolveAssistantPlan(edited, 'home', menu).question, undefined, 'Whole menu is one unambiguous group')
  edited = applyAssistantPlan(edited, 'home', menu, undefined, {}, true)
  edited = applyAssistantPlan(edited, 'home', plan('set', header, 'center', '/menuAlignment'), undefined, {}, true)
  edited = applyAssistantPlan(edited, 'home', plan('set', header, false, '/sticky'), undefined, {}, true)
  edited = applyAssistantPlan(edited, 'home', plan('set', header, '#fedcba', '/mobileMenuIconColor'), undefined, {}, true)
  edited = applyAssistantPlan(edited, 'home', plan('set', header, 'Talk to us', '/cta/label'), undefined, {}, true)
  edited = applyAssistantPlan(edited, 'home', plan('link', { scope: 'header', kind: 'link', text: 'Strategy' }, '/consulting'), undefined, {}, true)
  const props = definition.propsSchema.parse(edited.globalComponents.header!.props)
  const dom = new JSDOM(renderToStaticMarkup(React.createElement(definition.render, { props, context: { tokens: edited.tokens, baseUrl: '' } })))
  assert.equal(dom.window.document.querySelector('header')!.style.background, 'rgb(18, 52, 86)')
  const labels = dom.window.document.querySelectorAll<HTMLElement>('[data-awb-element^="/items/"][data-awb-element$="/label"]')
  assert.ok(labels.length >= 4)
  for (const label of labels) {
    assert.equal(label.style.color, 'rgb(171, 205, 239)')
    assert.equal(label.style.fontFamily, 'Georgia, serif')
    assert.equal(label.style.fontSize, '23px')
  }
  assert.ok(dom.window.document.querySelector('a[href="/consulting"]'))
  assert.equal(dom.window.document.querySelector('[data-awb-element="/cta"]')!.textContent, 'Talk to us')
  assert.deepEqual(edited.pages, headerModel.pages, 'Shared header changes preserve every page')
  assert.deepEqual(edited.globalComponents.footer, headerModel.globalComponents.footer)
  assert.throws(() => applyAssistantPlan(headerModel, 'home', plan('set', header, 'bad', '/cta/arbitrary'), undefined, {}, true), /not an editable/)
  const styled = applyAssistantPlan(headerModel, 'home', plan('style', header, { backgroundColor: '#654321' }), undefined, {}, true)
  assert.equal(styled.globalComponents.header!.props.backgroundColor, '#654321')
  const individual = applyAssistantPlan(headerModel, 'home', plan('style', { scope: 'header', kind: 'link', text: 'Strategy' }, { color: '#112233', fontSize: 26 }), undefined, {}, true)
  const individualDom = new JSDOM(renderToStaticMarkup(React.createElement(definition.render, { props: definition.propsSchema.parse(individual.globalComponents.header!.props), context: { tokens: individual.tokens, baseUrl: '' } })))
  assert.equal(individualDom.window.document.querySelector<HTMLElement>('[data-awb-element="/items/0/children/0/label"]')!.style.fontSize, '26px')
}
console.log('PASS: both shared-header variants render chatbot background changes, whole-menu colours/fonts, nested links, CTA copy, alignment, sticky and hamburger controls; confirmation and page isolation preserved.')
