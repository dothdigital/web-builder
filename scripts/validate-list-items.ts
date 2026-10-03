import assert from 'node:assert/strict'
import { getComponent } from '@awb/component-registry'
import { listItemTemplate } from '../apps/web/src/lib/list-item-template'
const stat = listItemTemplate('AboutSplitOverlap', '/stats')
assert.deepEqual(stat, { value: '', label: '' })
const about = getComponent('AboutSplitOverlap')!
assert.ok(about.propsSchema.safeParse({ ...(about.fixture as object), stats: [stat] }).success)
assert.deepEqual(listItemTemplate('HeroTypographic', '/keywords'), '')
assert.deepEqual(listItemTemplate('AboutSplitOverlap', '/points'), { title: '', body: '', number: '' })
const field = listItemTemplate('ContactSplit', '/formFields') as Record<string, unknown>
assert.equal(field.type, 'text')
assert.equal(field.name, '')
console.log('PASS: empty stats, string lists, process points and enum form fields use their component schemas.')
for (const id of ['HeaderTransparent', 'HeaderSplitUtility']) {
  const child = listItemTemplate(id, '/items/0/children')
  assert.deepEqual(child, { label: '', href: '' })
  const definition = getComponent(id)!
  assert.ok(definition.propsSchema.safeParse({ ...(definition.fixture as object), items: [{ label: 'Services', href: '/services', children: [{ ...(child as object), label: 'Consulting', href: '/services/consulting' }] }] }).success)
}
console.log('PASS: nested submenu items use label/link fields for both headers.')
