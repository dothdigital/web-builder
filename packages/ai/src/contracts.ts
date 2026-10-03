import { z } from 'zod'
import { designDnaSchema, designTokensSchema, sectionSchema, seoSchema } from '@awb/website-model'

/// Every AI response is parsed with one of these schemas before it is allowed
/// anywhere near the database (SOW 7.3).

export const briefAnalysisSchema = z.object({
  businessType: z.string(),
  industry: z.string(),
  audience: z.array(z.string()).default([]),
  tone: z.array(z.string()).default([]),
  goals: z.array(z.string()).default([]),
  locations: z.array(z.string()).default([]),
  services: z.array(z.string()).default([]),
  /// Facts the brief does not contain and that must never be invented.
  missingFacts: z.array(z.string()).default([]),
  confidence: z.number().min(0).max(1).default(0.5),
})
export type BriefAnalysis = z.infer<typeof briefAnalysisSchema>

export const followUpQuestionsSchema = z.object({
  questions: z
    .array(
      z.object({
        id: z.string(),
        question: z.string(),
        why: z.string(),
        inputType: z.enum(['text', 'textarea', 'select', 'multiselect', 'upload', 'boolean']),
        options: z.array(z.string()).default([]),
        required: z.boolean().default(false),
      }),
    )
    .max(8),
})
export type FollowUpQuestions = z.infer<typeof followUpQuestionsSchema>

export const designDirectionsSchema = z.object({
  options: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        rationale: z.string(),
        dna: designDnaSchema,
        tokens: designTokensSchema,
      }),
    )
    .min(2)
    .max(4),
})
export type DesignDirections = z.infer<typeof designDirectionsSchema>

const plannedLinkSchema = z.object({ label: z.string().min(1), path: z.string() })
export const plannedNavigationSchema = z.object({
  navigation: z.array(plannedLinkSchema.extend({ children: z.array(plannedLinkSchema).default([]) })).min(1).max(6),
})
export const sitePlanSchema = z.object({
  navigation: plannedNavigationSchema.shape.navigation.default([]),
  pages: z
    .array(
      z.object({
        path: z.string().regex(/^\/[a-z0-9\-/]*$/),
        title: z.string(),
        purpose: z.string(),
        inMainNav: z.boolean().default(true),
        serviceName: z.string().optional(),
        sectionPlan: z.array(z.object({ family: z.string(), intent: z.string() })).min(1),
      }),
    )
    .min(1),
})
export type SitePlan = z.infer<typeof sitePlanSchema>

export const pageContentSchema = z.object({
  path: z.string(),
  h1: z.string(),
  seo: seoSchema,
  sections: z.array(sectionSchema).min(1),
})
export type PageContent = z.infer<typeof pageContentSchema>

export const imagePlanSchema = z.object({
  images: z
    .array(
      z.object({
        slot: z.string(),
        prompt: z.string(),
        alt: z.string(),
        aspectRatio: z.enum(['1:1', '4:5', '3:4', '16:9', '16:10']).default('4:5'),
      }),
    )
    .default([]),
})
export type ImagePlan = z.infer<typeof imagePlanSchema>

export const reviewReportSchema = z.object({
  issues: z
    .array(
      z.object({
        level: z.enum(['error', 'warning', 'info']),
        area: z.enum(['design', 'seo', 'accessibility', 'content']),
        message: z.string(),
        pagePath: z.string().optional(),
        sectionId: z.string().optional(),
      }),
    )
    .default([]),
  summary: z.string().default(''),
})
export type ReviewReport = z.infer<typeof reviewReportSchema>
