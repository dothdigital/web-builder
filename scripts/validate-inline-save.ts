import assert from 'node:assert/strict'
import { bindInlineTextEditing, flushInlineTextEdits, hasActiveInlineEdit } from '../apps/web/src/app/projects/[id]/editor/inline-edit'
class TextElement {
  dataset: Record<string, string> = { awbElement: '/items/0/text' }
  style = { cursor: '', outline: '', whiteSpace: '' }
  title = ''
  childElementCount = 1
  parentElement = { closest: () => null }
  attributes = new Map([['data-awb-inline-text', 'true']])
  listeners = new Map<string, Set<(event: any) => void>>()
  text = 'Original paragraph'; markup = '<p>Original paragraph</p>'
  get childNodes() { return [{ markup: this.markup }] }
  replaceChildren(...nodes: Array<{ markup: string }>) { this.innerHTML = nodes.map(node => node.markup).join('') }
  get textContent() { return this.text }
  set textContent(value: string) { this.text = value; this.markup = value }
  get innerText() { return this.text }
  get innerHTML() { return this.markup }
  set innerHTML(value: string) { this.markup = value; this.text = value.replace(/<[^>]*>/g, '') }
  hasAttribute(name: string) { return this.attributes.has(name) }
  getAttribute(name: string) { return this.attributes.get(name) ?? null }
  setAttribute(name: string, value: string) { this.attributes.set(name, value) }
  removeAttribute(name: string) { this.attributes.delete(name) }
  addEventListener(name: string, listener: (event: any) => void) { if (!this.listeners.has(name)) this.listeners.set(name, new Set()); this.listeners.get(name)!.add(listener) }
  removeEventListener(name: string, listener: (event: any) => void) { this.listeners.get(name)?.delete(listener) }
  fire(name: string, data = {}) { this.listeners.get(name)?.forEach(listener => listener({ preventDefault() {}, stopPropagation() {}, ...data })) }
  focus() {}
  blur() { this.fire('blur') }
}
const previousWindow = globalThis.window
const fakeWindow = new EventTarget()
Object.assign(globalThis, { window: fakeWindow })
const edits: Array<[string, string]> = []
let dirtyEvents = 0
fakeWindow.addEventListener('awb-inline-input', () => dirtyEvents++)
const create = () => {
  const element = new TextElement()
  const container = { querySelectorAll: () => [element] }
  const cleanup = bindInlineTextEditing(container as unknown as HTMLElement, { items: [{ text: 'Original paragraph' }] }, (pointer, text) => edits.push([pointer, text]))
  return { element, cleanup }
}
try {
  const first = create()
  first.element.fire('dblclick'); first.element.textContent = 'Typed directly\nSecond line'; first.element.fire('input')
  assert.equal(dirtyEvents, 1)
  assert.equal(hasActiveInlineEdit(), true)
  flushInlineTextEdits()
  assert.deepEqual(edits, [['/items/0/text', 'Typed directly\nSecond line']])
  assert.equal(hasActiveInlineEdit(), false)
  flushInlineTextEdits(); first.cleanup()
  assert.equal(edits.length, 1, 'Save/blur/cleanup must not duplicate a commit')
  const second = create()
  second.element.fire('dblclick'); second.element.textContent = 'Keep on selection change'; second.cleanup()
  assert.equal(edits[1]?.[1], 'Keep on selection change')
  const third = create()
  third.element.fire('dblclick'); third.element.textContent = 'Cancel this'; third.element.fire('keydown', { key: 'Escape' }); third.cleanup()
  assert.equal(edits.length, 2, 'Escape cancels the edit')
  assert.equal(hasActiveInlineEdit(), false)
  console.log('PASS: inline input marks unsaved work; Save flushes multiline text; cleanup preserves edits; Escape cancels; commits are not repeated. DOM events mocked.')
} finally { Object.assign(globalThis, { window: previousWindow }) }
