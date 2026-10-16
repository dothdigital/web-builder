import { contrastRatio, readableForeground, type AiProvider, type GenerationBrief, type PaletteSuggestion } from '@awb/ai'
import { designTokensSchema } from '@awb/website-model'

export async function chooseAiBrandPalette(provider: Pick<AiProvider, 'proposeDesignDirections'>, brief: GenerationBrief) {
  const result = await provider.proposeDesignDirections({ ...brief, answers: { ...brief.answers, colourRequest: 'Choose the best coordinated website colours for this business and its uploaded logo. Use the detected logo colours as brand anchors with suitable neutrals and accessible text. Put your recommended palette in the first option. The user will preview and apply only the colours; keep rationale focused on the colour choice.' } }, {
    businessType: brief.businessName, industry: brief.industry ?? '', audience: [], tone: brief.tonePreferences,
    goals: brief.goals, locations: brief.location ? [brief.location] : [], services: brief.services, missingFacts: [], confidence: 0.5,
  })
  const chosen = result.data.options[0]
  if (!chosen) throw new Error('AI did not return a colour palette. Please try again.')
  const tokens = designTokensSchema.parse(chosen.tokens)
  if (!Object.values(tokens.palette).every(color => /^#[\da-f]{6}$/i.test(color))) throw new Error('AI returned an invalid colour palette. Please try again.')
  if (contrastRatio(tokens.palette.foreground, tokens.palette.background) < 4.5) tokens.palette.foreground = readableForeground(tokens.palette.background)
  if (contrastRatio(tokens.palette.primaryForeground, tokens.palette.primary) < 4.5) tokens.palette.primaryForeground = readableForeground(tokens.palette.primary)
  return { suggestion: { id: 'ai-chosen', label: 'AI chosen colours', rationale: chosen.rationale, tokens } satisfies PaletteSuggestion, usage: result.usage }
}
