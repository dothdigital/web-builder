import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { unlink } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import { JSDOM } from 'jsdom'
const outfile = `${process.cwd()}/scripts/.email-designer-ui-test.mjs`
const dom = new JSDOM('<!doctype html><html><body><form id="root"></form></body></html>', { url: 'http://localhost:3000' })
for (const name of ['window', 'document', 'Element', 'HTMLElement', 'HTMLDialogElement', 'Node', 'File', 'FormData', 'Event', 'MouseEvent']) Object.defineProperty(globalThis, name, { configurable: true, value: (dom.window as any)[name] })
Object.defineProperty(globalThis, 'getComputedStyle', { configurable: true, value: dom.window.getComputedStyle.bind(dom.window) })
;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true
;(dom.window.HTMLDialogElement.prototype as any).showModal = function () { this.open = true }
;(dom.window.HTMLDialogElement.prototype as any).close = function () { this.open = false }
let uploadCount = 0, previewCount = 0
;(globalThis as any).fetch = async (url: string) => ({ ok: true, json: async () => { if (url.includes('email-images')) { uploadCount++; return { src: '/api/email-images/12345678-1234-1234-1234-123456789abc.png' } }; previewCount++; return { html: '<html><body>Email preview</body></html>' } } })
const React = await import('react'); const { createRoot } = await import('react-dom/client')
const root = createRoot(document.getElementById('root')!)
try {
  await build({ entryPoints: ['apps/web/src/components/account/email-designer.tsx'], outfile, bundle: true, platform: 'node', format: 'esm', packages: 'external', jsx: 'automatic' })
  const { EmailDesigner } = await import(pathToFileURL(outfile).href)
  await React.act(async () => root.render(React.createElement(EmailDesigner, { body: 'Welcome to your website.' })))
  const button = (label: string) => [...document.querySelectorAll('button')].find(b => b.textContent === label)!
  const click = async (label: string) => { assert.ok(button(label), `Button ${label} exists`); await React.act(async () => button(label).click()) }
  const data = () => JSON.parse((document.querySelector('input[name=bodyDesign]') as HTMLInputElement).value)
  await click('Design email ↗'); assert.equal(document.querySelector('dialog')!.open, true)
  const editor = document.querySelector('[contenteditable=true]')!
  const text = editor.querySelector('p')!.firstChild!
  const range = document.createRange(); range.setStart(text, 0); range.setEnd(text, 7)
  await React.act(async () => { window.getSelection()!.removeAllRanges(); window.getSelection()!.addRange(range); document.dispatchEvent(new Event('selectionchange')) })
  await click('Bold'); assert.ok(data().blocks[0].html.includes('<strong>Welcome</strong>'), 'Selected words receive bold styling')
  await React.act(async () => { editor.innerHTML = '<p>Updated and saved text.</p>'; editor.dispatchEvent(new Event('input', { bubbles: true })) })
  assert.ok(data().blocks[0].html.includes('Updated and saved text'))
  await click('+ image'); assert.equal(data().blocks.length, 2)
  const file = new File(['fake image for upload mock'], 'logo.png', { type: 'image/png' })
  const input = document.querySelector('input[type=file]')!
  Object.defineProperty(input, 'files', { value: [file] })
  await React.act(async () => input.dispatchEvent(new Event('change', { bubbles: true })))
  assert.equal(uploadCount, 1); assert.ok(data().blocks[1].src.startsWith('/api/email-images/'))
  await click('Duplicate'); assert.equal(data().blocks.length, 3); assert.notEqual(data().blocks[1].id, data().blocks[2].id)
  await click('↑'); await click('Delete'); assert.equal(data().blocks.length, 2)
  await click('+ button'); assert.equal(data().blocks[2].href, '{{billing_url}}')
  const beforeDrag = data().blocks.map((b: any) => b.id)
  const transfer = { values: new Map<string, string>(), effectAllowed: '', dropEffect: '', setData(key: string, value: string) { this.values.set(key, value) }, getData(key: string) { return this.values.get(key) || '' } }
  const drag = async (element: Element, type: string, y: number) => {
    const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientY: y })
    Object.defineProperty(event, 'dataTransfer', { value: transfer })
    await React.act(async () => element.dispatchEvent(event))
  }
  let layers = document.querySelectorAll('.wt-email-layer')
  await drag(layers[0]!, 'dragstart', 0)
  await drag(layers[2]!, 'dragover', 10)
  assert.ok(layers[2]!.classList.contains('email-drop-after'), 'Drop destination is visible')
  await drag(layers[2]!, 'drop', 10)
  assert.deepEqual(data().blocks.map((b: any) => b.id), [beforeDrag[1], beforeDrag[2], beforeDrag[0]], 'List drag persists block order')
  const sections = document.querySelectorAll('.wt-email-canvas section')
  await drag(sections[2]!.querySelector('.wt-email-canvas-grip')!, 'dragstart', 0)
  await drag(sections[0]!, 'dragover', -1)
  await drag(sections[0]!, 'drop', -1)
  assert.deepEqual(data().blocks.map((b: any) => b.id), beforeDrag, 'Canvas handles also reorder blocks')
  await click('Preview email'); await React.act(async () => new Promise(resolve => setTimeout(resolve, 450)))
  assert.equal(previewCount, 1); assert.ok(document.querySelector('iframe')!.srcdoc.includes('Email preview'))
  await click('Mobile preview'); assert.equal(document.querySelector('iframe')!.style.width, '375px')
  await click('Back to editing')
  await click('+ Social icons')
  let social = data().blocks.at(-1)
  assert.equal(social.type, 'social'); assert.equal(social.socialLinks.length, 7)
  assert.equal(document.querySelectorAll('.wt-email-social-row img').length, 7, 'Add all social icons in one operation')
  const setInput = async (labelText: string, value: string) => {
    const label = [...document.querySelectorAll('label')].find(label => label.textContent?.trim().startsWith(labelText))
    const input = label?.querySelector('input') as HTMLInputElement
    assert.ok(input, `Input ${labelText} exists`)
    await React.act(async () => {
      Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value')!.set!.call(input, value)
      input.dispatchEvent(new Event('input', { bubbles: true }))
      input.dispatchEvent(new Event('change', { bubbles: true }))
    })
  }
  await setInput('Facebook link', 'https://facebook.com/webtummy')
  await setInput('Facebook colour', '#123456')
  social = data().blocks.at(-1)
  assert.equal(social.socialLinks[0].href, 'https://facebook.com/webtummy')
  assert.equal(social.socialLinks[0].color, '#123456')
  await setInput('All icons colour', '#abcdef')
  social = data().blocks.at(-1)
  assert.equal(social.color, '#abcdef'); assert.ok(social.socialLinks.every((link: any) => link.color === null))
  const remove = document.querySelector('button[aria-label="Remove Instagram icon"]') as HTMLButtonElement
  await React.act(async () => remove.click())
  assert.equal(data().blocks.at(-1).socialLinks.length, 6)
  await click('Add all missing icons')
  assert.equal(data().blocks.at(-1).socialLinks.length, 7)
  assert.equal(data().blocks.at(-1).socialLinks.find((link: any) => link.platform === 'facebook').href, 'https://facebook.com/webtummy', 'Restoring icons preserves existing profile links')
  const visualBlocks = data().blocks
  await click('HTML')
  assert.equal(data().mode, 'html')
  assert.ok(document.querySelector('textarea[aria-label="Full email HTML"]'))
  await click('Start from visual design')
  assert.ok(data().sourceHtml.includes('Email preview'), 'HTML can be populated from the visual-source endpoint')
  const customHtml = '<!doctype html><html><body><h1>Hi {{name}}</h1><p>Custom HTML email</p></body></html>'
  const source = document.querySelector('textarea[aria-label="Full email HTML"]') as HTMLTextAreaElement
  await React.act(async () => {
    Object.getOwnPropertyDescriptor(dom.window.HTMLTextAreaElement.prototype, 'value')!.set!.call(source, customHtml)
    source.dispatchEvent(new Event('input', { bubbles: true }))
  })
  assert.equal(data().sourceHtml, customHtml)
  await click('Visual'); assert.deepEqual(data().blocks, visualBlocks)
  await click('HTML'); assert.equal(data().sourceHtml, customHtml, 'Switching modes preserves HTML source')
  await click('Preview email'); await React.act(async () => new Promise(resolve => setTimeout(resolve, 450)))
  assert.ok(document.querySelector('iframe[title="HTML email preview"]'))
  await click('Done'); assert.equal(document.querySelector('dialog')!.open, false)
  const form = new FormData(document.querySelector('form')!); assert.equal(JSON.parse(String(form.get('bodyDesign'))).blocks.length, 4)
  assert.equal(JSON.parse(String(form.get('bodyDesign'))).mode, 'html')
  assert.equal(JSON.parse(String(form.get('bodyDesign'))).sourceHtml, customHtml)
  console.log('PASS: visual editor modal, selected-word formatting, direct text persistence, image upload, duplication, reordering, deletion, button defaults, list/canvas drag-and-drop, insertion indicators, preview, mobile sizing, social icons, profile links, per-icon/row colours, removal/restoration, full HTML editing/preview, mode switching and form submission data. Upload and preview endpoints mocked.')
} finally { await React.act(async () => root.unmount()); dom.window.close(); await unlink(outfile).catch(() => {}) }
