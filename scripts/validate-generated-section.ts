import assert from 'node:assert/strict'
import { validateGeneratedSection } from '../apps/web/src/lib/generated-section'
const props = { heading: 'Our approach', body: 'We begin by understanding your requirements.', layout: 'steps', points: [{ title: 'Understand', body: 'Discuss your requirements.' }] }
const result = validateGeneratedSection('auto', [{ op: 'add', path: '/componentId', value: 'AboutSplitOverlap' }, { op: 'add', path: '/props', value: props }])
assert.equal(result.componentId, 'AboutSplitOverlap')
assert.equal(result.props.heading, props.heading)
assert.equal(result.props.layout, 'steps')
assert.equal(validateGeneratedSection('AboutSplitOverlap', Object.entries(props).map(([key, value]) => ({ op: 'add', path: `/${key}`, value }))).props.heading, props.heading)
assert.throws(() => validateGeneratedSection('auto', [{ op: 'add', path: '/componentId', value: 'Nonexistent' }]))
assert.throws(() => validateGeneratedSection('auto', [{ op: 'add', path: '/componentId', value: 'HeroEditorial' }]))
assert.throws(() => validateGeneratedSection('AboutSplitOverlap', [{ op: 'add', path: '/heading', value: 'Incomplete' }]))
assert.throws(() => validateGeneratedSection('auto', [{ op: 'add', path: '/__proto__/polluted', value: true }]))
assert.throws(() => validateGeneratedSection('auto', [{ op: 'move', path: '/heading', from: '/body' }]))
console.log('PASS: automatic layout selection and explicit layout content; invalid layouts, incomplete content and unsafe operations rejected.')
