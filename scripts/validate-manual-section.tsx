import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { getComponent, defaultTokens } from '@awb/component-registry'
import { manualSection } from '../packages/component-registry/src/components/manual-section'
import { embedDocument } from '../packages/component-registry/src/embed-document'
Object.assign(globalThis, { React })
const definition = getComponent('ManualSection')!
assert.ok(definition)
assert.ok(definition.propsSchema.safeParse({ items: [] }).success)
const props = manualSection.propsSchema.parse({ items: [
 { id: 'h', kind: 'heading', text: 'My heading' },
 { id: 't', kind: 'text', text: 'My paragraph' },
 { id: 'l', kind: 'bullets', text: 'One\nTwo' },
 { id: 'b', kind: 'button', label: 'Contact', href: '/contact' },
 { id: 'e', kind: 'embed', html: '<div id="widget">Widget</div>', javascript: 'document.getElementById("widget").textContent="Ready"', css: '#widget{color:blue}', height: 300 },
] })
const render = (editing: boolean) => renderToStaticMarkup(React.createElement(manualSection.render, { props, context: { tokens: defaultTokens, baseUrl: '/', editing } }))
const preview = render(false)
assert.ok(preview.includes('My heading'))
assert.ok(preview.includes('<ul'))
assert.ok(preview.includes('href="/contact"'))
assert.ok(preview.includes('sandbox="allow-scripts allow-forms allow-popups"'))
assert.ok(!preview.includes('allow-same-origin'))
assert.ok(preview.includes('srcDoc='))
assert.ok(!render(true).includes('<iframe'))
assert.ok(render(true).includes('Open Preview'))
assert.equal(definition.propsSchema.safeParse({ items: [{ id: 'bad', kind: 'button', href: 'javascript:alert(1)' }] }).success, false)
assert.equal(definition.propsSchema.safeParse({ items: [{ id: 'bad', kind: 'embed', javascript: 'x'.repeat(50001) }] }).success, false)
assert.ok(embedDocument('', '', 'const text="</script>"').includes('<\\/script>'))
console.log('PASS: blank/manual elements, lists, safe button links, sandboxed embeds, editor placeholders and code limits.')
const movedProps = definition.propsSchema.parse({ items: [{ id: 'paragraph', kind: 'text', text: 'Move me down' }], elementOffsets: { '/items/0/text': { x: 0, y: 180 } } })
const movedHtml = renderToStaticMarkup(React.createElement(definition.render, { props: movedProps, context: { tokens: defaultTokens, baseUrl: '/', staticRenderScope: 'manual-move-test' } }))
assert.ok(movedHtml.includes('translate:0px 180px'), 'Paragraph movement must reach the rendered text wrapper')
assert.ok(movedHtml.includes('data-awb-element="/items/0/text"'))
console.log('PASS: manual paragraph movement reaches the rendered object and survives static rendering.')
