import assert from 'node:assert/strict'
import { reorderSections, sectionDropSlot } from '../apps/web/src/lib/section-order'
import type { WebsiteSection } from '@awb/website-model'
const sections = ['a', 'b', 'c', 'd'].map((id) => ({ id, componentId: 'HeroTypographic', componentVersion: '1.0.0', hidden: id === 'c', props: { heading: id } })) satisfies WebsiteSection[]
const original = JSON.stringify(sections)
const ids = (entries: WebsiteSection[]) => entries.map((entry) => entry.id)
assert.deepEqual(ids(reorderSections(sections, 'a', 4)), ['b', 'c', 'd', 'a'])
assert.deepEqual(ids(reorderSections(sections, 'd', 0)), ['d', 'a', 'b', 'c'])
assert.deepEqual(ids(reorderSections(sections, 'b', 3)), ['a', 'c', 'b', 'd'])
assert.deepEqual(ids(reorderSections(sections, 'c', 1)), ['a', 'c', 'b', 'd'])
assert.equal(reorderSections(sections, 'b', 2), sections)
assert.equal(reorderSections(sections, 'missing', 2), sections)
assert.equal(reorderSections(sections, 'a', -1), sections)
assert.equal(JSON.stringify(sections), original)
assert.equal(sectionDropSlot([40, 90, 140], 15), 0)
assert.equal(sectionDropSlot([40, 90, 140], 70), 1)
assert.equal(sectionDropSlot([40, 90, 140], 200), 3)
console.log('PASS: upward/downward insertion, first/last slots, hidden sections, cancelled/no-op moves, pointer drop boundaries, and immutable undo source.')
