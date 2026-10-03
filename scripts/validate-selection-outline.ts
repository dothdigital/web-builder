import assert from 'node:assert/strict'
import { outlinePath } from '../apps/web/src/lib/selection-outline'
const paths = ['/layout/0', '/items/0', '/items/0/text', '/items/1', '/items/1/imageUrl', '/items/2']
assert.equal(outlinePath('ManualSection', '/items/0/text', paths), '/items/0/text')
assert.equal(outlinePath('ManualSection', '/items/1/imageUrl', paths), '/items/1/imageUrl')
assert.equal(outlinePath('ManualSection', '/items/2/javascript', paths), '/items/2')
assert.equal(outlinePath('ManualSection', '/items/1', paths), '/items/1')
assert.equal(outlinePath('Other', '/items/0/text', paths), '/items/0/text')
assert.equal(outlinePath('Other', '/items/1/label', paths), '/items/1')
assert.equal(outlinePath('ManualSection', '/items/10/text', paths), undefined)
console.log('PASS: full manual-object borders, image/code ownership, property fallback and distinct object indices.')
