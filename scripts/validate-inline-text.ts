import assert from 'node:assert/strict'
import { textPointers } from '../apps/web/src/app/projects/[id]/editor/inline-edit'
const pairs = textPointers({ items: [{ kind: 'text', text: 'First paragraph\n\n- One\n- Two' }, { kind: 'embed', html: '<p>Ignore code</p>', css: 'body {}', javascript: 'alert(1)' }], freeElements: [{ content: { items: [{ text: 'Added object text' }] } }] })
assert.ok(pairs.some(pair => pair.pointer === '/items/0/text' && pair.value.includes('\n\n- One')))
assert.ok(pairs.some(pair => pair.pointer === '/freeElements/0/content/items/0/text'))
assert.ok(!pairs.some(pair => /\/(html|css|javascript|kind)$/.test(pair.pointer)))
console.log('PASS: multiline/list content and added objects have exact edit pointers; code and element types excluded.')
