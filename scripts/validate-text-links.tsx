import assert from 'node:assert/strict'
import React, { act, useState } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { JSDOM } from 'jsdom'
import { getComponent, defaultTokens, safeTextLink, type InlineLink } from '@awb/component-registry'
import { TextLinkControl, captureTextLink } from '../apps/web/src/app/projects/[id]/editor/text-link-control'
import { bindInlineTextEditing } from '../apps/web/src/app/projects/[id]/editor/inline-edit'
Object.assign(globalThis, { React })
async function main() {
  const dom = new JSDOM('<!doctype html><div id="canvas"></div><div id="toolbar"></div>', { url: 'http://localhost/' })
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, Event: dom.window.Event, IS_REACT_ACT_ENVIRONMENT: true })
  Object.defineProperty(dom.window.HTMLElement.prototype, 'innerText', { configurable: true, get() { return this.textContent } })
  const definition = getComponent('ManualSection')!
  let links: InlineLink[] = [{ text: 'advice', occurrence: 1, href: '/contact', newTab: true }]
  const props = definition.propsSchema.parse({ items: [{ id: 'text', kind: 'text', text: 'Trusted advice and clear advice.' }], inlineLinks: { '/items/0/text': links } })
  const html = renderToStaticMarkup(React.createElement(definition.render, { props, context: { tokens: defaultTokens, baseUrl: '' } }))
  const canvas = document.getElementById('canvas')!; canvas.innerHTML = html
  const element = canvas.querySelector<HTMLElement>('[data-awb-inline-text]')!
  assert.equal(element.querySelectorAll('a').length, 1)
  assert.equal(element.querySelector('a')!.getAttribute('href'), '/contact')
  assert.equal(element.querySelector('a')!.getAttribute('rel'), 'noopener noreferrer')
  assert.equal(element.querySelector('a')!.previousSibling!.textContent, 'Trusted advice and clear ')
  // Actual mouse selection captures the second occurrence, before toolbar focus.
  const anchor = element.querySelector('a')!
  const range = document.createRange(); range.selectNodeContents(anchor)
  window.getSelection()!.removeAllRanges(); window.getSelection()!.addRange(range)
  assert.deepEqual(captureTextLink(element), { text: 'advice', occurrence: 1 })
  let committed = ''
  const cleanup = bindInlineTextEditing(canvas, props, (_path, text) => { committed = text })
  element.dispatchEvent(new dom.window.MouseEvent('dblclick', { bubbles: true }))
  assert.equal(element.getAttribute('contenteditable'), 'plaintext-only')
  element.textContent = 'Trusted advice and clear advice. Updated.'
  element.dispatchEvent(new dom.window.FocusEvent('blur'))
  assert.equal(committed, 'Trusted advice and clear advice. Updated.')
  assert.equal(element.querySelectorAll('a').length, 1, 'React-owned link nodes restored after editing')
  cleanup()
  const { createRoot } = await import('react-dom/client')
  const root = createRoot(document.getElementById('toolbar')!)
  function Toolbar() {
    const [panel, setPanel] = useState('')
    return <><TextLinkControl open={panel === 'link'} onOpenChange={open => setPanel(open ? 'link' : '')} element={element} links={links} onChange={next => { links = next }} /><button onClick={() => setPanel('spacing')}>Spacing</button></>
  }
  const render = () => root.render(<Toolbar />)
  await act(async () => render())
  range.selectNodeContents(element.querySelector('a')!); window.getSelection()!.removeAllRanges(); window.getSelection()!.addRange(range)
  await act(async () => document.querySelector('[aria-label="Hyperlink selected text"]')!.dispatchEvent(new dom.window.MouseEvent('pointerdown', { bubbles: true, cancelable: true })))
  assert.equal((document.querySelector('[aria-label="Text hyperlink URL"]') as HTMLInputElement).value, '/contact')
  await act(async () => Array.from(document.querySelectorAll('button')).find(button => button.textContent === 'Spacing')!.click())
  assert.equal(document.querySelector('[aria-label="Text hyperlink"]'), null, 'Opening another toolbar panel closes Link')
  range.selectNodeContents(element.querySelector('a')!); window.getSelection()!.removeAllRanges(); window.getSelection()!.addRange(range)
  await act(async () => document.querySelector('[aria-label="Hyperlink selected text"]')!.dispatchEvent(new dom.window.MouseEvent('pointerdown', { bubbles: true, cancelable: true })))
  const remove = Array.from(document.querySelectorAll('button')).find(button => button.textContent === 'Remove link')!
  await act(async () => remove.click())
  assert.equal(links.length, 0)
  await act(async () => render())
  range.selectNodeContents(element.querySelector('a')!); window.getSelection()!.removeAllRanges(); window.getSelection()!.addRange(range)
  await act(async () => document.querySelector('[aria-label="Hyperlink selected text"]')!.dispatchEvent(new dom.window.MouseEvent('pointerdown', { bubbles: true, cancelable: true })))
  const input = document.querySelector<HTMLInputElement>('[aria-label="Text hyperlink URL"]')!
  await act(async () => {
    Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value')!.set!.call(input, 'https://example.com/advice')
    input.dispatchEvent(new dom.window.Event('input', { bubbles: true }))
    input.dispatchEvent(new dom.window.Event('change', { bubbles: true }))
  })
  await act(async () => Array.from(document.querySelectorAll('button')).find(button => button.textContent === 'Apply link')!.click())
  assert.equal(links[0]?.href, 'https://example.com/advice', 'Toolbar saves the entered URL')
  assert.equal(links[0]?.occurrence, 1)
  await act(async () => root.unmount())
  for (const url of ['javascript:alert(1)', 'data:text/html,test', '//evil.test', '/\\evil.test', 'https://ok.test\n']) assert.equal(safeTextLink(url), false)
  for (const url of ['https://example.com', '/contact', '#about', 'mailto:info@example.com', 'tel:+12345']) assert.equal(safeTextLink(url), true)
  assert.equal(definition.propsSchema.safeParse({ ...props, inlineLinks: { '/items/0/text': [{ text: 'advice', href: 'javascript:alert(1)' }] } }).success, false)
  const hero = getComponent('HeroTypographic')!
  const heroProps = hero.propsSchema.parse({ ...hero.fixture as object, heading: 'Clear trusted advice', inlineLinks: { '/heading': [{ text: 'trusted', href: '/about' }] } })
  const heroHtml = renderToStaticMarkup(React.createElement(hero.render, { props: heroProps, context: { tokens: defaultTokens, baseUrl: '' } }))
  canvas.innerHTML = heroHtml
  assert.equal(canvas.querySelector('h1')!.getAttribute('data-awb-rich-text'), 'true')
  assert.equal(canvas.querySelector('h1 a')!.textContent, 'trusted')
  const stop = bindInlineTextEditing(canvas, heroProps, () => {})
  assert.equal(canvas.querySelector('h1')!.dataset.awbPointer, '/heading')
  stop(); dom.window.close()
  console.log('PASS: persisted heading/paragraph links, repeated words, toolbar selection/removal, inline text editing, static export markup and unsafe URL rejection.')
}
main().catch(error => { console.error(error); process.exitCode = 1 })
