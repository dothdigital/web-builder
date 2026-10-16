import assert from 'node:assert/strict'
import { blogCoverPrompt, blogCoverRequestSchema } from '../packages/pipeline/src/content-creation'
const request = { topic: 'Education savings for families', keyword: 'RESP savings', details: 'Planning for future tuition expenses.', direction: 'Blue and gold editorial illustration', requestId: '89c98fe0-0a5f-4f67-a8f2-29c215aeb59f' }
const prompt = blogCoverPrompt(request)
for (const value of [request.topic, request.keyword, request.details, request.direction]) assert.ok(prompt.includes(value))
assert.ok(prompt.includes('Do not include text'))
assert.ok(prompt.includes('rather than defaulting to generic portraits'))
assert.equal(blogCoverRequestSchema.safeParse({ ...request, topic: '  ' }).success, false)
assert.equal(blogCoverRequestSchema.safeParse({ ...request, direction: 'x'.repeat(1001) }).success, false)
assert.equal(blogCoverRequestSchema.safeParse({ ...request, requestId: 'invalid' }).success, false)
assert.ok(blogCoverPrompt({ topic: 'Insurance', requestId: request.requestId }).includes('Choose an appropriate editorial'))
console.log('PASS: topic, keyword, brief and visual direction included; input limits and default art direction validated. No AI calls.')

const website = { ...request, purpose: 'website', imageDirection: { style: 'auto', styles: ['people', 'local'], notes: 'Use natural daylight.' } }
const websitePrompt = blogCoverPrompt(website)
for (const text of ['website section image', request.direction, 'human interactions', 'community context', 'Use natural daylight.']) assert.ok(websitePrompt.includes(text))
assert.ok(!websitePrompt.includes('cover image for a blog article'))
assert.equal(blogCoverRequestSchema.parse(request).purpose, 'blog', 'Existing cover requests remain compatible')
console.log('PASS: selected-image subject, latest instructions and shared style choices reach generation prompt.')
