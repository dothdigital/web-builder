import assert from 'node:assert/strict'
import { getComponent } from '@awb/component-registry'
import { addManualObject, objectChoices } from '../apps/web/src/lib/add-manual-object'
import type { WebsiteSection } from '@awb/website-model'
const blank: WebsiteSection = { id: 'blank', componentId: 'ManualSection', componentVersion: '1.0.0', hidden: false, props: { items: [] } }
const existing: WebsiteSection = { id: 'existing', componentId: 'AboutSplitOverlap', componentVersion: '1.0.0', hidden: false, props: structuredClone(getComponent('AboutSplitOverlap')!.fixture) }
const snapshot = JSON.stringify(existing)
for (const [kind] of objectChoices) {
  const manual = addManualObject(blank, kind, `manual-${kind}`, 300)
  assert.equal(manual.path, '/items/0')
  assert.ok(getComponent('ManualSection')!.propsSchema.safeParse(manual.section.props).success, kind)
  const inserted = addManualObject(existing, kind, `free-${kind}`, 750)
  assert.equal(inserted.path, '/freeElements/0')
  assert.ok(getComponent(existing.componentId)!.propsSchema.safeParse(inserted.section.props).success, `free ${kind}`)
  const free = inserted.section.props.freeElements as Array<{ y: number; height: number }>
  assert.ok(free[0]!.y >= 750)
  assert.ok(Number(inserted.section.props.freeLayoutMinHeight) >= free[0]!.y + free[0]!.height)
}
assert.equal(JSON.stringify(existing), snapshot)
assert.equal((blank.props.items as unknown[]).length, 0)
assert.throws(() => addManualObject(existing, 'text', 'too-tall', 10000), /too tall/)
console.log('PASS: all object tiles insert into blank and existing sections, validate, reserve space and preserve existing content.')
