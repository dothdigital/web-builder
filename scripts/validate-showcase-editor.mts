import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { unlink } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import { JSDOM } from 'jsdom'
import { getComponent } from '@awb/component-registry'
const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'http://localhost:3000', pretendToBeVisual: true })
for (const name of ['window', 'document', 'Element', 'HTMLElement', 'Node', 'File', 'FormData', 'Event', 'MouseEvent']) Object.defineProperty(globalThis, name, { configurable: true, value: (dom.window as any)[name] })
;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true
Object.assign(globalThis, { requestAnimationFrame: dom.window.requestAnimationFrame.bind(dom.window), cancelAnimationFrame: dom.window.cancelAnimationFrame.bind(dom.window), getComputedStyle: dom.window.getComputedStyle.bind(dom.window) })
const React = await import('react')
const { createRoot } = await import('react-dom/client')
const root = createRoot(document.getElementById('root')!)
const outfile = `${process.cwd()}/scripts/.showcase-editor-test.mjs`
let uploads = 0
globalThis.fetch = async (_url, init) => { assert.equal((init?.body as FormData).get('projectId'), 'test-project'); uploads++; return new Response(JSON.stringify({ asset: { url: '/uploads/new-badge.png' } })) }
URL.createObjectURL = () => 'blob:test-image'
URL.revokeObjectURL = () => {}
try {
  await build({ entryPoints: ['apps/web/src/app/projects/[id]/editor/inspector.tsx'], outfile, bundle: true, platform: 'node', format: 'esm', packages: 'external', jsx: 'automatic', tsconfig: 'apps/web/tsconfig.json', plugins: [{ name: 'test-router', setup(build) { build.onResolve({ filter: /^next\/navigation$/ }, () => ({ path: 'router', namespace: 'test' })); build.onLoad({ filter: /.*/, namespace: 'test' }, () => ({ contents: 'export const useRouter = () => ({ refresh() {} })', loader: 'js' })) } }] })
  const { Inspector } = await import(pathToFileURL(outfile).href)
  const click = async (text: string, position = 0) => {
    const button = [...document.querySelectorAll('button')].filter(button => button.textContent?.trim() === text)[position]
    assert.ok(button, text); await React.act(async () => button.click())
  }
  const type = async (label: string, value: string) => {
    const field = [...document.querySelectorAll('label')].find(entry => entry.textContent === label)?.querySelector('input')
    assert.ok(field, label)
    await React.act(async () => { Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value')!.set!.call(field, value); field.dispatchEvent(new Event('input', { bubbles: true })) })
  }
  for (const id of ['PortfolioShowcase', 'CredentialsShowcase']) {
    const definition = getComponent(id)!
    let props = definition.propsSchema.parse({}) as Record<string, any>
    const render = () => root.render(React.createElement(Inspector, { projectId: 'test-project', currentComponentId: id, componentName: definition.name, fields: definition.editorFields, props, imageUrls: { '/uploads/existing.png': '/api/projects/test-project/editor-image?assetId=image' }, variants: [], onSwitchVariant() {}, onChange(pointer: string, value: unknown) { assert.equal(pointer, ''); props = value as typeof props; render() } }))
    await React.act(async () => render())
    const kind = id === 'PortfolioShowcase' ? 'project or product' : 'credential'
    await click('+ Add ' + kind)
    assert.equal(props.items.length, 1)
    await type(id === 'PortfolioShowcase' ? 'Project / product name' : 'Credential / award name', 'First entry')
    assert.equal(props.items[0].title, 'First entry')
    await click('Choose from image library (1)')
    assert.ok(document.querySelector('img[src="/api/projects/test-project/editor-image?assetId=image&thumbnail=1&attempt=0"]'), 'Library renders an authenticated image thumbnail')
    await React.act(async () => (document.querySelector('button[aria-label="Use existing.png"]') as HTMLButtonElement).click())
    assert.equal(props.items[0].imageUrl, '/uploads/existing.png')
    await click('+ Add ' + kind)
    await click('Move up', 1)
    assert.equal(props.items[1].title, 'First entry')
    assert.equal(props.items[1].imageUrl, '/uploads/existing.png', 'Image follows its reordered item')
    await click('Remove ' + kind)
    assert.equal(props.items.length, 1)
    const upload = document.querySelector('input[type=file]') as HTMLInputElement
    Object.defineProperty(upload, 'files', { value: [new File(['image'], 'badge.png', { type: 'image/png' })], configurable: true })
    await React.act(async () => upload.dispatchEvent(new Event('change', { bubbles: true })))
    assert.equal(props.items[0].imageUrl, '/uploads/new-badge.png')
    assert.ok(document.querySelector('img[src="blob:test-image"]'), 'Uploaded image immediately previews')
  }
  assert.equal(uploads, 2)
  console.log('PASS: both showcase editors add/edit entries, select library thumbnails, reorder/delete entries, and save uploaded image URLs with immediate previews (mock upload).')
} finally { await React.act(async () => root.unmount()); await unlink(outfile).catch(() => {}) }
