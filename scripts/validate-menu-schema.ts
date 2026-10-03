import assert from 'node:assert/strict'
import { menuItemSchema } from '@awb/website-model'
const children = Array.from({ length: 8 }, (_, index) => ({ label: `Service ${index + 1}`, linkType: 'PAGE', pageId: `service-${index}`, children: [] }))
assert.equal(menuItemSchema.parse({ label: 'Services', linkType: 'PAGE', pageId: 'services', children }).children.length, 8)
assert.equal(menuItemSchema.safeParse({ label: 'Services', children: [{ label: '' }] }).success, false)
console.log('PASS: dropdowns support more than three service links; invalid menu entries are still rejected')
