import assert from 'node:assert/strict'
import { designReferenceSchema, normalizeReferenceUrl } from '@awb/shared/design-reference'
import { publicReferenceAddress, observeReferenceHtml, inspectDesignReference } from '../packages/pipeline/src/design-reference'
import { OpenAiProvider, StubAiProvider } from '@awb/ai'
assert.equal(normalizeReferenceUrl('kinexmedia.com/our-work/#projects'), 'https://kinexmedia.com/our-work/')
for (const url of ['file:///etc/passwd', 'ftp://example.com', 'http://localhost', 'http://service.internal/', 'https://user:password@example.com', 'https://example.com:5432']) assert.equal(designReferenceSchema.safeParse({ url }).success, false)
for (const address of ['127.0.0.1', '10.0.0.1', '172.16.1.2', '192.168.1.2', '169.254.169.254', '100.100.100.200', '0.0.0.0', '::1', '::ffff:127.0.0.1', 'fe80::1', 'fc00::1', '2001:db8::1', '2002:7f00:1::']) assert.equal(publicReferenceAddress(address), false, address)
assert.equal(publicReferenceAddress('93.184.215.14'), true)
assert.equal(publicReferenceAddress('2606:4700:4700::1111'), true)
const html = '<html><head><style>.hero{color:#123456;font-family:Georgia,serif}</style><script>private-script-secret</script></head><body><nav><a href="/">Home</a><a href="/work">Work</a></nav><section class="hero split"><h1>Reference business heading</h1><img src="/photo.png"></section><section class="portfolio grid"><h2>Selected work</h2><article>Some reference copy</article></section></body></html>'
const observation = observeReferenceHtml(html, 'both')
assert.equal(observation.status, 'read')
assert.equal(observation.structure?.sections, 2)
assert.equal(observation.structure?.images, 1)
assert.equal(observation.structure?.navigationLinks, 2)
assert.ok(observation.structure?.layoutHints.includes('grid'))
assert.ok(observation.style?.colors.includes('#123456'))
assert.ok(!JSON.stringify(observation).includes('private-script-secret'))
assert.ok(!JSON.stringify(observation).includes('/photo.png'), 'Reference asset URLs are never supplied for reuse')
assert.equal(observeReferenceHtml(html, 'layout').style, undefined)
assert.equal(observeReferenceHtml(html, 'style').structure, undefined)
assert.equal((await inspectDesignReference({ url: 'file:///not-allowed', mode: 'both', notes: '' })).status, 'unavailable', 'Unreadable references fall back without failing generation')
const brief = { businessName: 'Our studio', description: 'Our original business details and products.', services: [], goals: ['FORM'], tonePreferences: [], answers: {}, hasLogo: false, logoColors: [], uploadedImageUrls: [], testimonials: [], designReference: { url: 'https://example.com', mode: 'both' as const, notes: 'Use our own brand colours.', observation } }
const stub = new StubAiProvider({ seed: 'reference-test' })
const { data: analysis } = await stub.analyzeBrief(brief)
const { data: directions } = await stub.proposeDesignDirections(brief, analysis)
const originalFetch = globalThis.fetch
let messages: Array<{ role: string; content: string }> = []
globalThis.fetch = async (_url, init) => {
  messages = JSON.parse(String(init?.body)).messages
  return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(directions) } }], usage: { prompt_tokens: 1, completion_tokens: 1 } }))
}
try {
  await new OpenAiProvider({ apiKey: 'test-only' }).proposeDesignDirections(brief, analysis)
  assert.ok(messages.find(message => message.role === 'system')?.content.includes('untrusted website data'))
  assert.ok(messages.find(message => message.role === 'user')?.content.includes('Selected work'))
  assert.ok(messages.find(message => message.role === 'user')?.content.includes('Never copy the reference wording'))
  await new OpenAiProvider({ apiKey: 'test-only' }).proposeDesignDirections({ ...brief, designReference: undefined }, analysis)
  assert.ok(!messages.find(message => message.role === 'user')?.content.includes('designReference'), 'No reference is required')
} finally { globalThis.fetch = originalFetch }
console.log('PASS: reference URL validation, private-address rejection, structural extraction, mode isolation, fallback and AI prompt wiring (no live AI calls).')
