import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { getComponent, defaultTokens } from '@awb/component-registry'
import { duplicateElement, duplicableElement } from '../apps/web/src/lib/duplicate-element'
Object.assign(globalThis, { React })
const definition = getComponent('HeroEditorial')!
const props = { ...(definition.fixture as Record<string, unknown>), primaryCta: { label: 'Contact', href: '/contact' } }
const first = duplicateElement(props, '/primaryCta')!
assert.deepEqual(props.primaryCta, { label: 'Contact', href: '/contact' })
const second = duplicateElement(first.props, first.path)!
const parsed = definition.propsSchema.parse(second.props) as Record<string, unknown>
const extras = parsed.extraElements as Array<{ label: string; href: string; id: string; source: string }>
assert.equal(extras.length, 2)
assert.notEqual(extras[0]!.label, extras[1]!.label)
assert.notEqual(extras[0]!.id, extras[1]!.id)
assert.ok(extras.every((extra) => extra.href === '' && extra.source === '/primaryCta'))
const render = (input: Record<string, unknown>) => renderToStaticMarkup(React.createElement(definition.render, { props: definition.propsSchema.parse(input), context: { tokens: defaultTokens, baseUrl: '' } }))
const html = render(parsed)
assert.equal((html.match(/href="\/contact"/g) ?? []).length, 1)
for (let index = 0; index < 2; index++) assert.ok(html.includes(`data-awb-element="/extraElements/${index}"`))
const heading = duplicateElement(props, '/heading')!
assert.equal((render(heading.props).match(/<h1/g) ?? []).length, 1, 'Preserve a single H1')
assert.equal(duplicableElement('/primaryCta/label', props), undefined)
assert.equal(duplicableElement('/extraElements/0/label', first.props), undefined)
console.log('PASS: copies stay in section render, independent IDs/labels, no inherited button link, one H1, and child fields cannot duplicate separately.')
