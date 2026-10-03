import assert from 'node:assert/strict'
import { bindMarqueeSelection, marqueeTargets } from '../apps/web/src/app/projects/[id]/editor/marquee-selection'
class Node {
  dataset: Record<string, string> = {}
  style = {}
  children: Node[] = []
  parent?: Node
  listeners = new Map<string, Set<(event: any) => void>>()
  isContentEditable = false
  removed = false
  constructor(public rect = { left: 0, top: 0, right: 500, bottom: 500, width: 500, height: 500 }) {}
  getBoundingClientRect() { return this.rect }
  matches() { return false }
  hasAttribute(name: string) { return name === 'data-awb-image-container' && !!this.dataset.awbImageContainer }
  contains(node: Node): boolean { return this === node || this.children.some((child) => child.contains(node)) }
  querySelector() { return this.children[0] ?? null }
  querySelectorAll(selector: string): Node[] { return selector === '[data-awb-section-id]' ? this.children.filter((child) => child.dataset.awbSectionId) : this.children.flatMap((child) => [child, ...child.querySelectorAll(selector)]) }
  closest(selector: string): Node | null { if (selector === '[data-awb-element]' && this.dataset.awbElement || selector === '[data-awb-section-id]' && this.dataset.awbSectionId) return this; return this.parent?.closest(selector) ?? null }
  appendChild(node: Node) { node.parent = this; this.children.push(node) }
  remove() { this.removed = true }
  setPointerCapture() {}
  addEventListener(type: string, callback: (event: any) => void) { if (!this.listeners.has(type)) this.listeners.set(type, new Set()); this.listeners.get(type)!.add(callback) }
  removeEventListener(type: string, callback: (event: any) => void) { this.listeners.get(type)?.delete(callback) }
  fire(type: string, values = {}) { const event = { target: this, button: 0, shiftKey: true, pointerId: 1, clientX: 0, clientY: 0, preventDefault() {}, stopPropagation() {}, ...values }; this.listeners.get(type)?.forEach((callback) => callback(event)) }
}
const canvas = new Node(), section = new Node(), layout = new Node()
section.dataset.awbSectionId = 'story'; layout.dataset.awbElement = '/layout/0'
canvas.appendChild(section); section.appendChild(layout)
const texts = Array.from({ length: 4 }, (_, index) => { const node = new Node({ left: 100, right: 350, top: 50 + index * 60, bottom: 90 + index * 60, width: 250, height: 40 }); node.dataset.awbElement = `/text${index}`; layout.appendChild(node); return node })
const previous = { document: globalThis.document, window: globalThis.window }
Object.assign(globalThis, { document: { createElement: () => new Node(), body: new Node() }, window: new Node() })
const selected: Array<{ id: string; paths: string[] }> = []
let enabled = false, paths: string[] = []
const cleanup = bindMarqueeSelection(canvas as unknown as HTMLElement, () => ({ enabled, paths, sectionId: 'story', onSelect: (id, next) => { selected.push({ id, paths: next }); paths = next } }))
try {
  canvas.fire('pointerdown', { clientX: 20, clientY: 30 }) // Start in canvas margin.
  canvas.fire('pointermove', { clientX: 200, clientY: 280 })
  canvas.fire('pointerup', { clientX: 200, clientY: 280 })
  assert.deepEqual(selected[0], { id: 'story', paths: ['/text0', '/text1', '/text2', '/text3'] }, 'Partial overlap selects four texts, not their layout parent')
  assert.equal(canvas.dataset.awbMarqueeHandled, 'true', 'Click cannot immediately clear the marquee result')
  canvas.fire('pointerdown', { target: texts[1], clientX: 120, clientY: 120 })
  canvas.fire('pointerup', { clientX: 120, clientY: 120 })
  assert.deepEqual(paths, ['/text0', '/text2', '/text3'], 'Shift-click toggles one item')
  enabled = true
  canvas.fire('pointerdown', { shiftKey: false, clientX: 360, clientY: 100 })
  canvas.fire('pointerup', { shiftKey: false, clientX: 90, clientY: 45 })
  assert.deepEqual(paths, ['/text0'], 'Select area works without Shift and in reverse direction')
  const card = new Node({ left: 10, top: 10, right: 90, bottom: 90, width: 80, height: 80 }); card.dataset.awbElement = '/points/0'
  const child = new Node({ left: 20, top: 20, right: 80, bottom: 80, width: 60, height: 60 }); child.dataset.awbElement = '/points/0/title'; card.appendChild(child)
  assert.deepEqual(marqueeTargets([card, child] as unknown as HTMLElement[], { left: 0, top: 0, right: 100, bottom: 100 }).map((node) => node.dataset.awbElement), ['/points/0'], 'Fully enclosed card is selected once with its contents')
} finally { cleanup(); Object.assign(globalThis, previous) }
assert.ok([...canvas.listeners.values()].every((entries) => entries.size === 0))
console.log('PASS: Shift-drag from canvas margin, partial intersection, four independent text selections, Shift-click toggle, Select area without Shift, reverse drag, parent-child deduplication, click suppression and cleanup. DOM events mocked.')
