import { config } from 'dotenv'
config({ path: '.env', override: true, quiet: true })
import assert from 'node:assert/strict'
import { OpenAiProvider, createAiProvider } from '@awb/ai'
import { getComponent } from '@awb/component-registry'
const provider = createAiProvider()
if (!(provider instanceof OpenAiProvider)) throw new Error('OpenAI is not configured')
const context = {
  website: 'Example', page: { id: 'home', title: 'Home', path: '/', sections: [{ id: 'hero', componentId: 'HeroTypographic', props: { heading: 'Protect today. Plan for tomorrow.', primaryCta: { label: 'Get in touch', href: '/contact' }, secondaryCta: { label: 'Learn more', href: '/about' } } }] },
  targets: [{ section: '1. HERO — Protect today. Plan for tomorrow.', kind: 'text', label: 'Section heading — Protect today. Plan for tomorrow.' }, { section: '1. HERO — Protect today. Plan for tomorrow.', kind: 'button', label: 'Primary button — Get in touch' }, { section: '1. HERO — Protect today. Plan for tomorrow.', kind: 'button', label: 'Secondary button — Learn more' }],
  instruction: 'Change the button background to blue', history: [], assets: [],
}
const ambiguous = await provider.planEditorCommand(context)
assert.ok(ambiguous.data.kind === 'ask' || ambiguous.data.kind === 'edit')
if (ambiguous.data.kind === 'edit') {
 assert.ok(ambiguous.data.operations.length)
 assert.ok(ambiguous.data.operations.every(operation => !operation.target.all && !operation.target.text && operation.target.scope === 'page'), 'Generic button requests must not silently pick a button')
}
const exact = await provider.planEditorCommand({ ...context, instruction: 'Can you change Protect today. Plan for tomorrow. to a better headline?'  })
assert.equal(exact.data.kind, 'edit')
assert.ok(exact.data.operations.some(operation => operation.action === 'text' && typeof JSON.parse(operation.valueJson) === 'string' && JSON.parse(operation.valueJson).length > 10 && JSON.parse(operation.valueJson) !== 'Protect today. Plan for tomorrow.'))
console.log('PASS: live configured OpenAI returns a safe ambiguous-button request and an AI-authored improved headline. No website changes or publication performed.')

const headerDefinition = getComponent('HeaderSplitUtility')!
const sharedContext = { ...context, shared: { header: { componentId: 'HeaderSplitUtility', props: headerDefinition.fixture } }, targets: [
  ...context.targets.map(target => ({ ...target, scope: 'page' })),
  { scope: 'header', section: '1. HEADER — Split navigation with utility bar', sectionId: 'header', path: '', kind: 'section', label: 'Shared header', componentId: 'HeaderSplitUtility', editableFields: headerDefinition.editorFields },
  { scope: 'header', section: '1. HEADER — Split navigation with utility bar', sectionId: 'header', path: '/items', kind: 'element', label: 'Navigation menu (all links)' },
] }
for (const [instruction, property, expected] of [
  ['Change the global header background colour to #123456', 'backgroundColor', '#123456'],
  ['Change the menu text colour to #abcdef', 'color', '#abcdef'],
  ['Change the navigation menu font to Georgia, serif and size to 23px', 'fontFamily', 'Georgia'],
] as const) {
  const result = await provider.planEditorCommand({ ...sharedContext, instruction })
  assert.equal(result.data.kind, 'edit', instruction)
  assert.ok(result.data.operations.length, instruction)
  assert.ok(result.data.operations.every(operation => operation.target.scope === 'header'), 'Shared requests must not change page sections')
  const operation = result.data.operations.find(operation => property === 'backgroundColor'
    ? operation.action === 'set' && operation.property === '/backgroundColor' || operation.action === 'style' && JSON.parse(operation.valueJson).backgroundColor
    : operation.action === 'style' && JSON.parse(operation.valueJson)[property])
  assert.ok(operation, instruction)
  const value = JSON.parse(operation.valueJson)
  assert.ok(String(operation.action === 'set' ? value : value[property]).includes(expected), instruction)
  if (property !== 'backgroundColor') {
    assert.equal(operation.target.kind, 'element')
    assert.equal(operation.target.text, 'Navigation menu (all links)')
  }
}
console.log('PASS: live chatbot routes global header background, menu colour and menu typography requests to shared editor controls.')
