import { z } from 'zod'

/// AI patch contract (SOW 21.1). Paths are JSON-Pointer-like and are validated
/// against the target component's prop schema before anything is committed.
export const aiPatchSchema = z.object({
  target: z.object({
    pageId: z.string().optional(),
    sectionId: z.string().optional(),
    scope: z.enum(['field', 'section', 'page', 'site']).default('section'),
  }),
  operations: z
    .array(
      z.object({
        op: z.enum(['replace', 'add', 'remove', 'move']),
        path: z.string().regex(/^\/[A-Za-z0-9_\-\/]*$/),
        value: z.unknown().optional(),
        from: z.string().optional(),
      }),
    )
    .min(1),
  reason: z.string().min(1),
  requiresReview: z.boolean().default(true),
})

export type AiPatch = z.infer<typeof aiPatchSchema>
