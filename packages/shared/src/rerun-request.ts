import { z } from 'zod'

export const rerunRequestSchema = z.object({
  scope: z.enum(['CONTENT', 'IMAGES', 'FULL', 'UPLOADS']),
  instruction: z.string().trim().max(4000).default(''),
  imageAssetIds: z.array(z.string().min(1)).max(10).default([]),
  logoAssetId: z.string().min(1).optional(),
}).strict().superRefine((value, context) => {
  if (value.scope !== 'UPLOADS' && !value.instruction) context.addIssue({ code: 'custom', path: ['instruction'], message: 'Describe what you want AI to change.' })
  if (value.scope === 'UPLOADS' && !value.logoAssetId && !value.imageAssetIds.length) context.addIssue({ code: 'custom', path: ['imageAssetIds'], message: 'Upload a logo or at least one photo.' })
  if (value.scope === 'CONTENT' && (value.logoAssetId || value.imageAssetIds.length)) context.addIssue({ code: 'custom', message: 'Choose images or uploads to replace assets.' })
})

export type RerunRequest = z.infer<typeof rerunRequestSchema>
