import assert from 'node:assert/strict'
import { defaultTokens, tokensToCssVars } from '@awb/component-registry'
import type { WebsiteModel } from '@awb/website-model'
import { designTokensSchema } from '@awb/website-model'
import { resolveContactLinks, contactRoute } from '../apps/web/src/lib/contact-links'
const model = { pages: [{ path: '/request-a-quote' }], test: [{ href: '/contact' }, { href: '/contact#form' }, { href: '/contact?source=hero' }, { href: 'https://example.com/contact' }, { href: '/contact-other' }] } as unknown as WebsiteModel
const original = JSON.stringify(model)
assert.equal(contactRoute(model), '/request-a-quote')
const result = resolveContactLinks(model) as unknown as { test: Array<{ href: string }> }
assert.deepEqual(result.test.map((entry) => entry.href), ['/request-a-quote', '/request-a-quote#form', '/request-a-quote?source=hero', 'https://example.com/contact', '/contact-other'])
assert.equal(JSON.stringify(model), original)
const tokens = designTokensSchema.parse({ ...defaultTokens, buttons: { background: '#123456', text: '#ffffff', outline: '#654321' } })
const vars = tokensToCssVars(tokens) as Record<string, unknown>
assert.equal(vars['--awb-button-bg'], '#123456')
assert.equal(vars['--awb-button-fg'], '#ffffff')
assert.equal(vars['--awb-button-outline'], '#654321')
assert.equal(vars['--awb-primary'], defaultTokens.palette.primary)
assert.equal((tokensToCssVars(defaultTokens) as Record<string, unknown>)['--awb-button-outline'], 'currentColor')
console.log('PASS: contact aliases resolve to the existing quote page, external links stay intact, button colours remain independent and defaults are preserved.')
