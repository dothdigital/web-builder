import assert from 'node:assert/strict'
import React, { act } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { JSDOM } from 'jsdom'
import { getComponent, siteChrome, defaultTokens } from '@awb/component-registry'
import type { WebsiteModel } from '@awb/website-model'
import { MenuManagement } from '../apps/web/src/app/projects/[id]/editor/menu-management'
Object.assign(globalThis, { React })

async function main() {
  const columns = [
    { title: 'Brand', kind: 'logo', items: [] },
    { title: 'Main links', kind: 'links', items: [{ label: 'Chosen page', href: '/chosen' }] },
    { title: 'Information', kind: 'links', items: [] },
    { title: 'Address', kind: 'address', items: [] },
    { title: 'More', kind: 'links', items: [{ label: 'Fifth column', href: '/fifth' }] },
  ]
  const model = { globalComponents: { header: { props: { items: [] } }, footer: { props: { businessName: 'Test business', layoutManaged: true, columns, address: '123 Main Street' } } }, pages: [{ title: 'Unwanted page', path: '/unwanted' }], contact: {}, socials: [] } as unknown as WebsiteModel
  const chrome = siteChrome(model)
  assert.deepEqual(chrome.footer.columns, columns, 'Every saved column survives normalization')
  for (const id of ['FooterEditorial', 'FooterCompact']) {
    const component = getComponent(id)!
    const props = component.propsSchema.parse(chrome.footer)
    const html = renderToStaticMarkup(React.createElement(component.render, { props, context: { tokens: defaultTokens, baseUrl: '/preview/site' } }))
    const doc = new JSDOM(html).window.document
    assert.equal(doc.querySelectorAll('nav').length, 5)
    assert.match(html, /123 Main Street/)
    assert.match(html, /Fifth column/)
    assert.match(html, /href="\/preview\/site\/chosen"/)
    assert.doesNotMatch(html, /Unwanted page/)
  }
  model.globalComponents.footer.props.columns = []
  assert.deepEqual(siteChrome(model).footer.columns, [], 'An intentionally empty footer stays empty')
  model.globalComponents.header.props.items = []
  assert.deepEqual(siteChrome(model).header.items, [], 'An intentionally empty header stays empty')

  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost' })
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, Event: dom.window.Event, IS_REACT_ACT_ENVIRONMENT: true })
  const { createRoot } = await import('react-dom/client')
  const root = createRoot(document.getElementById('root')!)
  let saved: Record<string, unknown> = { ...chrome.footer, columns }
  const render = async () => { await act(async () => root.render(<MenuManagement footer props={saved} pages={model.pages} onChange={(path, value) => { assert.equal(path, ''); saved = value as Record<string, unknown> }} />)) }
  await render()
  const click = async (text: string) => { const button = Array.from(document.querySelectorAll('button')).find(b => b.textContent === text)!; assert.ok(button, text); await act(async () => button.click()); await render() }
  await click('Remove link')
  assert.equal((saved.columns as typeof columns)[1]!.items.length, 0)
  assert.equal(model.pages.length, 1, 'Removing a menu link does not remove a page')
  const count = document.querySelector('select')!
  await act(async () => { count.value = '3'; count.dispatchEvent(new dom.window.Event('change', { bubbles: true })) })
  await render()
  assert.equal((saved.columns as typeof columns).length, 3)
  assert.equal(saved.layoutManaged, true)
  await click('+ Add custom link')
  assert.equal((saved.columns as typeof columns)[1]!.items.length, 1)
  await act(async () => root.unmount())
  dom.window.close()
  console.log('PASS: both footer variants render five named columns, selected links only, contact data and preview destinations; empty menus persist; UI removes links, resizes columns and adds custom links without deleting pages.')
}
main().catch(error => { console.error(error); process.exit(1) })
