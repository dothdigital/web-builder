import assert from 'node:assert/strict'
import { sectionElementTree } from '../apps/web/src/lib/element-tree'
import { objectTextPointer } from '../apps/web/src/lib/object-editing'
const props = { items: [{ id: 'p', kind: 'text', text: 'My paragraph', label: 'Learn more' }] }
const tree = sectionElementTree('ManualSection', props)
assert.equal(tree.length, 1)
assert.ok(tree[0]!.label.startsWith('Paragraph'))
assert.equal(tree[0]!.path, '/items/0/text')
assert.equal(tree[0]!.children.length, 0)
assert.equal(objectTextPointer(props, '/items/0'), '/items/0/text')
console.log('PASS: clear paragraph selection tree and correct text pointer, without layout entries.')
