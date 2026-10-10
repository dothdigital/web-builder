import { z } from 'zod'
export const contentDirectionSchema = z.object({
  style: z.enum(['auto', 'informative', 'conversational', 'professional', 'persuasive', 'educational', 'custom']).default('auto'),
  audience: z.string().trim().max(500).default(''),
  styles: z.array(z.enum(["informative", "conversational", "professional", "persuasive", "educational", "custom"])).max(6).optional(),
  notes: z.string().trim().max(1500).default(''),
})
export type ContentDirection = z.infer<typeof contentDirectionSchema>
export const contentStyleOptions = [ ['auto', 'Let AI choose'], ['informative', 'Straightforward and informative'], ['conversational', 'Warm and conversational'], ['professional', 'Formal and professional'], ['persuasive', 'Persuasive and action-focused'], ['educational', 'Detailed and educational'], ['custom', 'Custom direction'] ] as const
export function contentDirectionPrompt(value: ContentDirection) {
  const selected = value.styles?.length ? [...new Set(value.styles)] : [value.style]
  return `Content style: Blend these writing preferences: ${selected.map(style => contentStyleOptions.find(([id]) => id === style)?.[1]).join(', ')}. ${value.audience ? `Intended audience: ${value.audience}.` : ''} ${value.notes ? `Writing preferences: ${value.notes}.` : ''} Use only supplied business facts. Do not invent claims, testimonials, guarantees or qualifications.`
}
