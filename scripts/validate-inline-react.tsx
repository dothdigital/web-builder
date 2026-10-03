import assert from 'node:assert/strict'
import React, { act, useEffect, useMemo, useState } from 'react'
import { JSDOM } from 'jsdom'
import { ArticleBody } from '../packages/component-registry/src/components/article-body'
import { flushInlineTextEdits, useInlineTextEditing } from '../apps/web/src/app/projects/[id]/editor/inline-edit'
async function main() {
  const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'http://localhost/' })
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, Event: dom.window.Event, IS_REACT_ACT_ENVIRONMENT: true })
  Object.defineProperty(dom.window.HTMLElement.prototype, 'innerText', { configurable: true, get() { return this.textContent }, set(value: string) { this.textContent = value } })
  const { createRoot } = await import('react-dom/client')
  let saved = ''
  let current = ''
  function Editor() {
    const [text, setText] = useState('Original paragraph')
    const [container, setContainer] = useState<HTMLDivElement | null>(null)
    const [dirty, setDirty] = useState(false)
    const props = useMemo(() => ({ items: [{ text }] }), [text])
    current = text
    useInlineTextEditing(container, true, props, (_pointer, value) => setText(value))
    useEffect(() => { const onInput = () => setDirty(true); window.addEventListener('awb-inline-input', onInput); return () => window.removeEventListener('awb-inline-input', onInput) }, [])
    return <><div ref={setContainer}><ArticleBody text={text} path="/items/0/text" data-awb-element="/items/0/text" /></div><span>{dirty ? 'Unsaved' : 'Saved'}</span></>
  }
  const root = createRoot(document.getElementById('root')!)
  try {
    await act(async () => root.render(<Editor />))
    const body = () => document.querySelector<HTMLElement>('[data-awb-inline-text]')!
    const edit = async (value: string) => {
      await act(async () => body().dispatchEvent(new dom.window.MouseEvent('dblclick', { bubbles: true })))
      await act(async () => { body().textContent = value; body().dispatchEvent(new dom.window.Event('input', { bubbles: true })) })
      assert.equal(body().textContent, value, 'Typing must survive the dirty-state rerender')
    }
    assert.equal(body().lastElementChild instanceof dom.window.HTMLElement && (body().lastElementChild as HTMLElement).style.marginBottom, '0px', 'The final paragraph must not add space that disappears during editing')
    await edit('Changed paragraph\nSecond line')
    await act(async () => body().dispatchEvent(new dom.window.FocusEvent('blur')))
    assert.equal(current, 'Changed paragraph\nSecond line', 'Inline text must update the model')
    assert.equal(body().textContent, 'Changed paragraph\nSecond line', 'Rendered paragraph must not revert after React commits')
    await edit('Save while editing')
    await act(async () => flushInlineTextEdits())
    saved = current
    assert.equal(saved, 'Save while editing')
    assert.equal(body().textContent, saved)
    await edit('Cancel this text')
    await act(async () => body().dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
    assert.equal(body().textContent, saved)
    assert.equal(current, saved)
    console.log('PASS: real React/DOM typing, dirty rerender, blur, active-edit save and Escape preserve visible and model text.')
  } finally { await act(async () => root.unmount()); dom.window.close() }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
