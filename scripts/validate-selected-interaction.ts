import assert from 'node:assert/strict'
import { bindSelectedObjectInteraction } from '../apps/web/src/app/projects/[id]/editor/selected-object-interaction'

class FakeElement {
  attributes = new Map<string, string>()
  dataset: Record<string, string> = {}
  isContentEditable = false
  input = false
  children: FakeElement[] = []
  contains(target: FakeElement) { return target === this || this.children.includes(target) }
  listeners = new Map<string, Set<(event: any) => void>>()
  style = { cursor: '', touchAction: '', setProperty: (name: string, value: string) => { if (name === 'cursor') this.style.cursor = value; if (name === 'touch-action') this.style.touchAction = value } }
  setAttribute(name: string, value: string) { this.attributes.set(name, value) }
  getAttribute(name: string) { return this.attributes.get(name) ?? null }
  removeAttribute(name: string) { this.attributes.delete(name) }
  closest(selector: string) { return selector === '[data-awb-element]' ? this : this.input || this.isContentEditable ? this : null }
  addEventListener(name: string, fn: (event: any) => void) { if (!this.listeners.has(name)) this.listeners.set(name, new Set()); this.listeners.get(name)!.add(fn) }
  removeEventListener(name: string, fn: (event: any) => void) { this.listeners.get(name)?.delete(fn) }
  fire(name: string, data: Record<string, unknown> = {}) {
    const event = { target: this, button: 0, pointerId: 1, clientX: 20, clientY: 30, defaultPrevented: false, preventDefault() { this.defaultPrevented = true }, stopPropagation() {}, ...data }
    this.listeners.get(name)?.forEach((fn) => fn(event))
    return event
  }
}
const fakeWindow = new FakeElement()
const previousWindow = globalThis.window
Object.assign(globalThis, { window: fakeWindow })
const element = new FakeElement()
const nudges: number[][] = [], moves: number[][] = []
let starts = 0, finishes = 0, cancels = 0
const cleanup = bindSelectedObjectInteraction(element as unknown as HTMLElement, () => ({ onStart: (event) => { starts++; event.preventDefault() }, onMove: (x, y) => moves.push([x, y]), onFinish: () => finishes++, onCancel: () => cancels++, onNudge: (x, y) => nudges.push([x, y]) }))
try {
  assert.equal(element.getAttribute('tabindex'), '0')
  assert.equal(element.getAttribute('draggable'), 'false')
  assert.equal(element.fire('pointerdown').defaultPrevented, true)
  element.fire('pointermove', { clientX: 60, clientY: 75 })
  element.fire('pointerup', { clientX: 65, clientY: 80 })
  assert.equal(starts, 1); assert.equal(finishes, 1)
  assert.equal(element.fire('pointerdown', { shiftKey: true }).defaultPrevented, false)
  assert.equal(starts, 1, 'Shift-click stays available for multi-selection instead of starting a drag')
  assert.deepEqual(moves, [[60, 75], [65, 80]])
  fakeWindow.fire('keydown', { target: element, key: 'ArrowLeft' })
  fakeWindow.fire('keydown', { target: element, key: 'ArrowDown', shiftKey: true })
  assert.deepEqual(nudges, [[-1, 0], [0, 10]])
  const input = new FakeElement(); input.input = true
  assert.equal(fakeWindow.fire('keydown', { target: input, key: 'ArrowRight' }).defaultPrevented, false)
  element.isContentEditable = true
  fakeWindow.fire('keydown', { target: element, key: 'ArrowRight' })
  element.fire('pointerdown')
  assert.equal(starts, 1, 'Typing does not start object dragging')
  assert.equal(nudges.length, 2, 'Typing/form arrows never move an object')
  element.isContentEditable = false
  fakeWindow.fire('keydown', { target: element, key: 'Escape' })
  assert.equal(cancels, 1)
  const child = new FakeElement(); element.children.push(child)
  assert.equal(element.fire('pointerdown', { target: child }).defaultPrevented, true, 'Drag a selected object by its paragraph child')
  element.fire('pointerup', { target: child })
  child.isContentEditable = true
  assert.equal(element.fire('pointerdown', { target: child }).defaultPrevented, false, 'Editing a child must not drag its parent')
} finally { cleanup(); Object.assign(globalThis, { window: previousWindow }) }
assert.equal(element.getAttribute('tabindex'), null)
assert.equal(element.getAttribute('draggable'), null)
assert.equal(element.style.cursor, '')
assert.ok([...element.listeners.values()].every((listeners) => listeners.size === 0))
assert.equal(fakeWindow.listeners.get('keydown')?.size, 0)
console.log('PASS: direct pointer drag, final drop coordinates, arrow nudging, Shift precision, edit/input guards, Escape, and listener cleanup. DOM events mocked.')
