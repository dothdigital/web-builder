import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { JSDOM } from 'jsdom'
import { getComponent, defaultTokens } from '@awb/component-registry'
Object.assign(globalThis, { React })
const definition = getComponent('ContactSplit')!
const fields = [
 { name: 'name', label: 'Name', type: 'text', required: true },
 { name: 'quantity', label: 'Quantity', type: 'number', required: true },
 { name: 'service', label: 'Service', type: 'select', options: ['Advice', 'Planning'], required: true },
 { name: 'channel', label: 'Contact by', type: 'radio', options: ['Email', 'Phone'], required: true },
 { name: 'consent', label: 'I agree to the Privacy Policy', type: 'checkbox', required: true, labelFontSize: 18, labelCase: 'none', linkText: 'Privacy Policy', linkUrl: '/privacy' },
]
const render = (submissionUrl = '') => renderToStaticMarkup(React.createElement(definition.render, { props: definition.propsSchema.parse({ heading: 'Contact', formFields: fields, submissionUrl }), context: { tokens: defaultTokens, baseUrl: '/', forms: { projectId: 'project-test', action: '/api/leads', recaptchaSiteKey: 'test-site-key' } } }))
const dom = new JSDOM(render())
const form = dom.window.document.querySelector('form')!
assert.equal(form.checkValidity(), false)
for (const [name, value] of [['name', 'Test'], ['quantity', '2.5'], ['service', 'Advice']]) (form.elements.namedItem(name) as HTMLInputElement).value = value
;(form.querySelector('[name="channel"]') as HTMLInputElement).checked = true
assert.equal(form.checkValidity(), false, 'Unchecked consent must prevent submission')
;(form.elements.namedItem('consent') as HTMLInputElement).checked = true
assert.equal(form.checkValidity(), true)
const checkbox = form.elements.namedItem('consent') as HTMLInputElement
const label = checkbox.closest('label')!
assert.equal(label.firstElementChild, checkbox, 'Checkbox precedes its label')
assert.equal(label.querySelector('a')?.getAttribute('href'), '/privacy')
assert.equal((label.querySelector('[data-awb-element$="/label"]') as HTMLElement).style.fontSize, '18px')
assert.equal((label.querySelector('[data-awb-element$="/label"]') as HTMLElement).style.textTransform, 'none')
assert.equal(definition.propsSchema.safeParse({ heading: 'Contact', formFields: [{ name: 'consent', label: 'Accept', type: 'checkbox', linkText: 'Accept', linkUrl: 'javascript:alert(1)' }] }).success, false)
const payload = new dom.window.FormData(form)
assert.equal(payload.get('consent'), 'yes')
assert.equal(payload.get('service'), 'Advice')
assert.equal(payload.get('channel'), 'Email')
assert.equal(payload.get('quantity'), '2.5')
const external = new JSDOM(render('https://crm.example/form'))
assert.equal(external.window.document.querySelector('form')!.action, 'https://crm.example/form')
assert.equal(external.window.document.querySelector('[name="projectId"]'), null)
assert.equal(external.window.document.querySelector('.g-recaptcha'), null)
assert.equal(definition.propsSchema.safeParse({ heading: 'Contact', submissionUrl: 'javascript:alert(1)' }).success, false)
dom.window.close(); external.window.close()
console.log('PASS: required text, number, dropdown, radio and consent validation; submission payload; external form endpoint isolation.')
const multiProps = definition.propsSchema.parse({ heading: 'Contact', formFields: [{ name: 'consent', type: 'checkbox', label: 'I agree to the Privacy Policy and Terms', labelLinks: [{ text: 'Terms', url: '/terms' }, { text: 'Privacy Policy', url: '/privacy' }] }] })
const multi = new JSDOM(renderToStaticMarkup(React.createElement(definition.render, { props: multiProps, context: { tokens: defaultTokens, baseUrl: '/' } })))
assert.deepEqual(Array.from(multi.window.document.querySelectorAll('label a')).map(link => [link.textContent, link.getAttribute('href')]), [['Privacy Policy', '/privacy'], ['Terms', '/terms']])
assert.equal(multi.window.document.querySelector('label')!.textContent!.trim(), 'I agree to the Privacy Policy and Terms')
multi.window.close()
console.log('PASS: multiple label links render in text order without losing surrounding words; legacy single links remain supported.')
import { addManualObject } from '../apps/web/src/lib/add-manual-object'
const manual = getComponent('ManualSection')!
const added = addManualObject({ id: 'blank', componentId: 'ManualSection', componentVersion: '1.0.0', hidden: false, props: { items: [] } }, 'form', 'form-1', 0)
const formProps = manual.propsSchema.parse(added.section.props)
const standalone = new JSDOM(renderToStaticMarkup(React.createElement(manual.render, { props: formProps, context: { tokens: defaultTokens, baseUrl: '/', forms: { projectId: 'project-test', action: '/api/leads' } } })))
assert.deepEqual(Array.from(standalone.window.document.querySelectorAll('input:not([type="hidden"]),textarea')).map(input => input.getAttribute('name')), ['name', 'email', 'phone', 'message'])
assert.equal(standalone.window.document.querySelector('button[type="submit"]')?.textContent, 'Submit')
assert.equal(standalone.window.document.querySelector('form')?.getAttribute('action'), '/api/leads')
assert.equal(standalone.window.document.querySelector('input[name="projectId"]')?.getAttribute('value'), 'project-test')
standalone.window.close()
console.log('PASS: Add object form includes editable defaults, submit button and project submission context in static rendering.')
