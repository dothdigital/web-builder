import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { getComponent, defaultTokens, importedTemplates } from '@awb/component-registry'
import { contactSchema } from '../packages/website-model/src/model'
Object.assign(globalThis, { React })
const contacts = contactSchema.parse({ emails: ['one@example.com', 'two@example.com'], phones: ['+1 555 1234', '+1 555 5678'] })
assert.equal(contacts.emails?.length, 2)
assert.equal(contactSchema.safeParse({ emails: ['invalid'] }).success, false)
const importedFooters = importedTemplates.map(template => (template as unknown as { footer: string }).footer).filter(Boolean)
for (const id of ['FooterEditorial', 'FooterCompact', ...importedFooters]) {
  const component = getComponent(id)!
  const render = (emails: string[], phones: string[], socials: Array<{platform: string; href: string}>) => renderToStaticMarkup(React.createElement(component.render, { props: component.propsSchema.parse({ ...component.fixture, businessName: 'Test business', emails, phones, socials, address: '123 New Street' }), context: { tokens: defaultTokens, baseUrl: '' } }))
  const html = render(contacts.emails!, contacts.phones!, [{ platform: 'Instagram', href: 'https://instagram.com/example' }])
  assert.ok(html.includes('mailto:one@example.com'), id)
  assert.ok(html.includes('mailto:two@example.com'), id)
  assert.ok(html.includes('tel:+1 555 5678'), id)
  assert.ok(html.includes('aria-label="Instagram"'), id)
  const removed = render([], [], [])
  assert.ok(!removed.includes('mailto:one@example.com'), id)
  assert.ok(!removed.includes('aria-label="Instagram"'), id)
}
console.log('PASS: multiple contacts round-trip, invalid emails rejected, footer contact links and social icons render and can be removed.')
