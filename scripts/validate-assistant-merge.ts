import assert from 'node:assert/strict'
import { mergeAssistantChanges, sameEditorValue } from '../apps/web/src/lib/assistant-merge'
const before = { pages: [{ id: 'home', sections: [{ id: 'hero', props: { heading: 'Protect today. Plan for tomorrow.', color: '#112233' } }, { id: 'contact', props: { heading: 'Contact us' } }] }, { id: 'about', sections: [] }], globalComponents: { header: { props: { label: 'Home' } } } }
const proposed = structuredClone(before)
proposed.pages[0]!.sections[0]!.props.heading = 'Protect What Matters. Build a Confident Tomorrow.'
const reorderedKeys = (value: unknown): unknown => Array.isArray(value) ? value.map(reorderedKeys) : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).reverse().map(([key, entry]) => [key, reorderedKeys(entry)])) : value
const databaseSnapshot = reorderedKeys(before) as typeof before
assert.equal(sameEditorValue(databaseSnapshot, before), true)
assert.notEqual(JSON.stringify(databaseSnapshot), JSON.stringify(before), 'Reproduce database JSON key order differences')
assert.deepEqual(mergeAssistantChanges(databaseSnapshot, proposed, before), proposed)
const concurrent = structuredClone(before)
concurrent.pages[0]!.sections[1]!.props.heading = 'Speak to our team'
concurrent.pages[0]!.sections[0]!.props.color = '#abcdef'
concurrent.globalComponents.header.props.label = 'Start here'
const merged = mergeAssistantChanges(databaseSnapshot, proposed, concurrent)
assert.equal(merged.pages[0]!.sections[0]!.props.heading, proposed.pages[0]!.sections[0]!.props.heading)
assert.equal(merged.pages[0]!.sections[0]!.props.color, '#abcdef')
assert.equal(merged.pages[0]!.sections[1]!.props.heading, 'Speak to our team')
assert.equal(merged.globalComponents.header.props.label, 'Start here')
const conflict = structuredClone(before)
conflict.pages[0]!.sections[0]!.props.heading = 'My newer headline'
assert.throws(() => mergeAssistantChanges(before, proposed, conflict), /heading changed/)
assert.equal(conflict.pages[0]!.sections[0]!.props.heading, 'My newer headline')
const reordered = structuredClone(before)
reordered.pages[0]!.sections.reverse()
assert.equal(mergeAssistantChanges(before, proposed, reordered).pages[0]!.sections[1]!.props.heading, proposed.pages[0]!.sections[0]!.props.heading)
const removed = structuredClone(before)
removed.pages[0]!.sections.shift()
assert.throws(() => mergeAssistantChanges(before, proposed, removed), /changed/)
assert.equal(before.pages[0]!.sections[0]!.props.heading, 'Protect today. Plan for tomorrow.')
console.log('PASS: database JSON key order, headline-only merge, concurrent unrelated edits, section reordering, same-headline conflicts, removed targets and immutable history.')

const indexed = { props: { items: [{ id: 'a', text: 'First' }, { id: 'b', text: 'Second' }], elementColors: {} as Record<string, unknown> } }
const styleProposal = structuredClone(indexed)
styleProposal.props.elementColors['/items/0/text'] = { color: '#112233' }
const movedItems = structuredClone(indexed)
movedItems.props.items.reverse()
assert.throws(() => mergeAssistantChanges(indexed, styleProposal, movedItems), /changed/)
console.log('PASS: reordered objects cannot redirect pending indexed style changes.')
