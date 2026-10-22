import assert from 'node:assert/strict'
import { businessClassicContract, validateBusinessClassicCopy, BUSINESS_CLASSIC_ID, defaultTokens } from '@awb/component-registry'
import { OpenAiProvider, StubAiProvider, type GenerationBrief } from '@awb/ai'
const path = '/'
const contract = businessClassicContract(path)
const content = {
  path, h1: 'Insurance and investment guidance',
  seo: { title: 'Insurance guidance | Example', description: 'Learn about the insurance and investment services supplied by Example. Get in touch to discuss the available options for your needs.', index: true },
  sections: [...contract.map((section, index) => ({ id: `section-${index}`, componentId: section.componentId, componentVersion: '1.0.0', hidden: false, props: Object.fromEntries(section.fields.map(field => [field.key, field.required ? 'Insurance guidance for your needs' : ''])) })), { id: 'faq', componentId: 'FaqAccordion', componentVersion: '1.0.0', hidden: false, props: { heading: 'Questions', items: [{ question: 'How do I enquire?', answer: 'Use the contact form.' }, { question: 'Where are you based?', answer: 'Toronto.' }] } }],
}
assert.deepEqual(validateBusinessClassicCopy(content, path), [])
const invalid = structuredClone(content)
invalid.sections[0]!.props = { ...invalid.sections[0]!.props, className: 'new-layout', imageUrl: 'invented.png' }
const required = contract[1]!.fields.find(field => field.required)!
invalid.sections[1]!.props[required.key] = ''
assert.ok(validateBusinessClassicCopy(invalid, path).some(error => error.includes('application-owned')))
assert.ok(validateBusinessClassicCopy(invalid, path).some(error => error.includes('missing')))
const oversized = structuredClone(content)
oversized.h1 = 'x'.repeat(100)
assert.ok(validateBusinessClassicCopy(oversized, path).some(error => error.includes('84')))
const reordered = structuredClone(content)
reordered.sections.reverse()
assert.ok(validateBusinessClassicCopy(reordered, path).some(error => error.includes('exact Business Classic section order')))
for (const pagePath of ['/about', '/services', '/services/life-insurance', '/contact']) assert.ok(businessClassicContract(pagePath).length)
const brief: GenerationBrief = { templateId: BUSINESS_CLASSIC_ID, businessName: 'Example', description: 'Insurance guidance for customers in Toronto.', services: ['Life insurance'], goals: ['FORM'], tonePreferences: [], answers: {}, hasLogo: true, logoColors: [], uploadedImageUrls: [], testimonials: [] }
const stub = new StubAiProvider({ seed: 'classic-contract' })
const { data: analysis } = await stub.analyzeBrief(brief)
const { data: directions } = await stub.proposeDesignDirections(brief, analysis)
const originalFetch = globalThis.fetch
let calls = 0
let lastMessages: Array<{ role: string; content: string }> = []
globalThis.fetch = async (_url, options) => {
  calls++
  lastMessages = JSON.parse(String(options?.body)).messages
  return Response.json({ choices: [{ message: { content: JSON.stringify(calls === 1 ? invalid : content) } }], usage: { prompt_tokens: 1, completion_tokens: 1 } })
}
try {
  const result = await new OpenAiProvider({ apiKey: 'mock-only' }).writePage(brief, analysis, directions.options[0]!.dna, defaultTokens, { path, title: 'Home', purpose: brief.description, inMainNav: true, sectionPlan: [] })
  assert.equal(calls, 2, 'Invalid layout edits must trigger correction before acceptance')
  assert.ok(lastMessages[0]!.content.includes('Business Classic slot contract'))
  assert.ok(lastMessages.some(message => message.content.includes('application-owned')))
  assert.equal(result.data.sections[0]!.componentId, contract[0]!.componentId)
  assert.equal(result.data.sections[0]!.props.className, undefined)
} finally { globalThis.fetch = originalFetch }
console.log('PASS: Business Classic fixed sections, text-only slots, copy limits, required content, inner-page contracts and AI correction cycle; no live AI calls.')
