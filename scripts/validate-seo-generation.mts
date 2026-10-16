import assert from 'node:assert/strict'
import { OpenAiProvider } from '@awb/ai'
import { importedTemplates, templateGenerationComponents, getComponent } from '@awb/component-registry'
const provider = new OpenAiProvider({ apiKey: 'synthetic-no-network' })
const templateId = importedTemplates[0]!.id
const ids = templateGenerationComponents(templateId, '/', false)
const data = { path: '/', h1: 'Test business', seo: { title: 'Test business', description: 'Factual test business information.', index: true }, sections: [...ids.map((id, index) => ({ id: `layout-${index}`, componentId: id, props: getComponent(id)!.fixture })), { id: 'faq', componentId: 'FaqAccordion', props: { heading: 'Questions', items: [{ question: 'How can I enquire?', answer: 'Use the contact page.' }, { question: 'Where can I read more?', answer: 'Read the services page.' }] } }] }
let calls = 0
;(provider as any).complete = async (_task: unknown, _schema: unknown, prompt: string, _input: string, validate: (data: unknown) => string[]) => {
 calls++
 assert.match(prompt, /FaqAccordion/)
 assert.match(prompt, /120–160/)
 assert.deepEqual(validate(data), [])
 assert.ok(validate({ ...data, sections: data.sections.slice(0, -1) }).length, 'Reject missing visible FAQ')
 return { data: structuredClone(data), usage: {} }
}
const result = await provider.writePage({ templateId, testimonials: [] } as any, {} as any, {} as any, {} as any, { path: '/', title: 'Home', sectionPlan: [] } as any)
assert.equal(calls, 1)
assert.equal(result.data.sections.at(-1)!.componentId, 'FaqAccordion')
assert.equal((result.data.sections.at(-1)!.props.items as unknown[]).length, 2)
assert.deepEqual(result.data.sections.slice(0, -1).map(section => section.componentId), ids)
console.log('PASS: template generation retains its prescribed layout, appends factual visible FAQ content, requires metadata limits, and rejects a missing FAQ. No AI request made.')
