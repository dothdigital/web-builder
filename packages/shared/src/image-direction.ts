import { z } from 'zod'
export const imageDirectionSchema = z.object({
  style: z.enum(['auto', 'people', 'local', 'combination', 'industry', 'illustration', 'custom']).default('auto'),
  styles: z.array(z.enum(["people", "local", "combination", "industry", "illustration", "custom"])).max(6).optional(),
  notes: z.string().trim().max(1500).default(''),
})
export type ImageDirection = z.infer<typeof imageDirectionSchema>
export const imageStyleOptions = [
  ['auto', 'Let AI choose'], ['people', 'People and human moments'],
  ['local', 'Local places and community'], ['combination', 'People with local context'],
  ['industry', 'Industry-specific imagery'], ['illustration', 'Illustrations and abstract visuals'],
  ['custom', 'Custom direction'],
] as const
export function imageDirectionPrompt(direction: ImageDirection, location?: string) {
  const styles = {
    auto: 'Choose imagery relevant to the section and business.',
    people: 'Focus on natural, candid people and human interactions relevant to this service.',
    local: 'Focus on local environments and community context. Avoid generic foreign landmarks.',
    combination: 'Combine natural people with local environments and community context.',
    industry: 'Focus on relevant industry activities, products, equipment or service settings.',
    illustration: 'Use professional illustrations or abstract visuals relevant to the service rather than photography.',
    custom: 'Follow the user’s custom visual direction.',
  }
  const selected = direction.styles?.length ? [...new Set(direction.styles)] : [direction.style]
  return `Website image direction: Combine these preferences coherently across relevant sections: ${selected.map(style => styles[style]).join(' ')}${location && selected.some(style => ['local', 'combination'].includes(style)) ? ` Local context: ${location}. Use plausible settings; do not claim a specific business premises or real client.` : ''}${direction.notes ? ` User visual preferences: ${direction.notes}` : ''}`
}
