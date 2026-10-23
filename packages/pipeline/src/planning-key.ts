import { createHash } from 'node:crypto'
import type { GenerationBrief } from '@awb/ai'
// Page subjects and navigation depend on intake facts, not visual theme or assets.
export function planningKey(brief: GenerationBrief): string {
  const canonical = (value: unknown): unknown => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([key,item])=>[key,canonical(item)])) : value
  return createHash('sha256').update(JSON.stringify(canonical({
    businessName: brief.businessName, description: brief.description, industry: brief.industry,
    location: brief.location, serviceAreas: brief.serviceAreas, services: brief.services,
    goals: brief.goals, answers: brief.answers, contentDirection: brief.contentDirection,
    homepageLength: brief.homepageLength, homepageSections: brief.homepageSections,
    serviceAreaPlacement: brief.serviceAreaPlacement, testimonials: brief.testimonials,
  }))).digest('hex')
}
