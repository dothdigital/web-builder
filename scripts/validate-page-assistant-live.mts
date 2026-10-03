import { config } from 'dotenv'
config({ path: '.env', override: true, quiet: true })
import assert from 'node:assert/strict'
import { OpenAiProvider, createAiProvider } from '@awb/ai'
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
