import assert from 'node:assert/strict'
import React, { act } from 'react'
import { JSDOM } from 'jsdom'
import { build } from 'esbuild'
import { createRequire } from 'node:module'
import { websiteModelSchema } from '@awb/website-model'
import { defaultTokens, getComponent } from '@awb/component-registry'
import { assistantPlanSchema } from '@awb/ai/editor-command'
const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost', pretendToBeVisual: true })
Object.assign(globalThis, { React, window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, Event: dom.window.Event, CustomEvent: dom.window.CustomEvent, IS_REACT_ACT_ENVIRONMENT: true })
dom.window.HTMLElement.prototype.scrollTo = () => {}
const chrome = (id: string) => ({ componentId: id, componentVersion: '1.0.0', props: getComponent(id)!.fixture })
const model = websiteModelSchema.parse({ schemaVersion: '1.0.0', site: { name: 'Example', previewHost: 'example.test' }, businessProfileRef: 'test', tokens: defaultTokens, designDna: { direction: 'corporate', composition: { symmetry: 'symmetric', density: 'balanced', width: 'wide', rhythm: 'modular' }, typography: { headingStyle: 'geometric-sans', bodyStyle: 'clean-sans', scale: 'standard' }, imagery: { style: 'documentary', dominance: 'medium', treatment: 'natural' }, navigation: 'split-nav', motion: 'none', corners: 'soft', ctaStyle: 'solid', colorBehavior: 'tonal' }, navigation: { primaryMenu: [] }, globalComponents: { header: chrome('HeaderSplitUtility'), footer: chrome('FooterCompact') }, pages: [{ id: 'home', path: '/', title: 'Home', h1: 'Home', seo: { title: 'Home', description: 'Useful advice from our business.' }, sections: [{ id: 'hero', componentId: 'HeroTypographic', props: { ...(getComponent('HeroTypographic')!.fixture as object), secondaryCta: { label: 'Learn more', href: '/about' } } }] }] })
const plan = assistantPlanSchema.parse({ kind: 'edit', message: 'Make the button blue.', operations: [{ action: 'style', target: { kind: 'button' }, valueJson: '{"backgroundColor":"#123456"}' }] })
let jobs: unknown[] = [], requests = 0, changes = 0, highlights = 0, result: typeof model | undefined
;(globalThis as Record<string, unknown>).__assistantMock = {
 queuePageAssistant: async () => { requests++; jobs = [{ id: 'test-job', status: 'READY', instruction: 'Make the button blue', originalPage: Object.fromEntries(Object.entries(model.pages[0]!).reverse()), originalGlobals: model.globalComponents, result: { plan } }]; return { jobId: 'test-job' } },
 readPageAssistantJobs: async () => jobs,
 finishPageAssistantJob: async () => { jobs = [] },
 dismissContentJob: async () => {},
}
const bundled = await build({ entryPoints: ['apps/web/src/app/projects/[id]/editor/page-assistant-drawer.tsx'], bundle: true, platform: 'node', format: 'cjs', packages: 'external', write: false, jsx: 'automatic', plugins: [{ name: 'mock-actions', setup(builder) {
 builder.onResolve({ filter: /app\/actions\// }, args => ({ path: args.path, namespace: 'mock' }))
 builder.onLoad({ filter: /.*/, namespace: 'mock' }, () => ({ contents: 'const mock = globalThis.__assistantMock; export const queuePageAssistant = mock.queuePageAssistant, readPageAssistantJobs = mock.readPageAssistantJobs, finishPageAssistantJob = mock.finishPageAssistantJob, dismissContentJob = mock.dismissContentJob; export const createContentWithAi = async()=>{},generateAiSection=async()=>{},rewritePageWithAi=async()=>{};', loader: 'js' }))
 builder.onResolve({ filter: /^\.\/(inspector|content-create-panel)$/ }, args => ({ path: args.path, namespace: 'ui-mock' }))
 builder.onLoad({ filter: /.*/, namespace: 'ui-mock' }, () => ({ contents: 'export const ImageField = () => null; export const ContentCreatePanel = () => null;', loader: 'js' }))
} }] })
const module = { exports: {} as Record<string, React.ComponentType<Record<string, unknown>>> }
new Function('require', 'module', 'exports', bundled.outputFiles[0]!.text)(createRequire(new URL('../package.json', import.meta.url)), module, module.exports)
const Drawer = module.exports.PageAssistantDrawer!
const { createRoot } = await import('react-dom/client')
const root = createRoot(document.getElementById('root')!)
const click = async (element: Element) => act(async () => { element.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); await new Promise(resolve => setTimeout(resolve, 20)) })
try {
 await act(async () => { root.render(React.createElement(Drawer, { projectId: 'test', pageId: 'home', model, imageUrls: {}, open: true, onClose: () => {}, onApply: (next: typeof model) => { changes++; result = next }, onSelect: () => { highlights++ }, onUndo: () => {}, canUndo: true, onPageSelect: () => {} })); await new Promise(resolve => setTimeout(resolve, 20)) })
 const input = document.querySelector('textarea')!
 await act(async () => { Object.getOwnPropertyDescriptor(dom.window.HTMLTextAreaElement.prototype, 'value')!.set!.call(input, 'Make the button blue'); input.dispatchEvent(new dom.window.Event('input', { bubbles: true })); input.dispatchEvent(new dom.window.Event('change', { bubbles: true })) })
 const send = Array.from(document.querySelectorAll('button')).find(button => button.textContent === 'Send')!
 await click(send)
 await act(async () => { window.dispatchEvent(new Event('awb-content-queued')); await new Promise(resolve => setTimeout(resolve, 30)) })
 assert.equal(requests, 1)
 assert.equal(changes, 0, 'Ambiguous requests must not change the page')
 assert.ok(document.body.textContent?.includes('Which one should I change?'), document.body.textContent ?? '')
 const choice = Array.from(document.querySelectorAll('button')).find(button => button.textContent?.includes('Primary button'))!
 assert.ok(choice, 'Visible labelled choices must be available')
 await click(choice)
 assert.equal(changes, 1)
 assert.ok(highlights >= 1)
 assert.equal((result!.pages[0]!.sections[0]!.props.elementColors as Record<string, { backgroundColor: string }>)['/primaryCta']!.backgroundColor, '#123456')
 assert.ok(document.body.textContent?.includes('Applied to your draft'))
 await click(document.querySelector('[aria-label="Assistant add menu"]')!)
 for (const text of ['New page', 'New blog', 'Upload / choose image']) assert.ok(document.body.textContent?.includes(text))
 console.log('PASS: React drawer queues a request, asks which button, highlights/applies exactly one choice, and exposes the + menu.')
} finally { await act(async () => root.unmount()); dom.window.close() }
