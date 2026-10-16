import assert from 'node:assert/strict'
import { defaultTokens } from '@awb/component-registry'
import { contrastRatio } from '@awb/ai'
import type { AiProvider, GenerationBrief } from '@awb/ai'
import { chooseAiBrandPalette } from '../apps/web/src/lib/ai-brand-palette'
const brief: GenerationBrief = { businessName: 'Fixture business', description: 'Insurance planning', industry: 'Insurance', logoColors: ['#01481d', '#f8b900'], hasLogo: true, services: [], goals: [], tonePreferences: [], answers: {}, uploadedImageUrls: [], testimonials: [] }
const palette = { ...defaultTokens.palette, primary: '#01481d', accent: '#f8b900', primaryForeground: '#01481d', foreground: '#ffffff', background: '#ffffff' }
let captured: GenerationBrief | undefined
const provider = { proposeDesignDirections: async (input: GenerationBrief) => {
  captured = input
  return { data: { options: [{ id: 'chosen', rationale: 'Green and gold reflect the logo.', tokens: { ...defaultTokens, palette } }] }, usage: { model: 'test', costCents: 0 } }
} } as unknown as Pick<AiProvider, 'proposeDesignDirections'>
const result = await chooseAiBrandPalette(provider, brief)
assert.deepEqual(captured?.logoColors, brief.logoColors)
assert.match(captured!.answers.colourRequest!, /first option/)
assert.equal(result.suggestion.id, 'ai-chosen')
assert.equal(result.suggestion.tokens.palette.accent, '#f8b900')
assert.ok(contrastRatio(result.suggestion.tokens.palette.foreground, result.suggestion.tokens.palette.background) >= 4.5)
assert.ok(contrastRatio(result.suggestion.tokens.palette.primaryForeground, result.suggestion.tokens.palette.primary) >= 4.5)
await assert.rejects(chooseAiBrandPalette({ proposeDesignDirections: async () => ({ data: { options: [] } }) } as unknown as typeof provider, brief), /did not return/)
await assert.rejects(chooseAiBrandPalette({ proposeDesignDirections: async () => ({ data: { options: [{ tokens: { ...defaultTokens, palette: { ...palette, primary: 'invalid' } } }] } }) } as unknown as typeof provider, brief), /invalid colour/)
console.log('PASS: AI receives logo/business context, returns a reviewable palette, enforces readable text and rejects empty/invalid responses without applying changes.')
