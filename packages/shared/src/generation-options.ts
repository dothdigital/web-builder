import { z } from 'zod'
import { imageDirectionSchema } from './image-direction'
import { contentDirectionSchema } from './content-direction'
export const generationOptionsSchema = z.object({
  mode: z.enum(['full', 'content', 'images', 'content-images', 'fill-images']).default('full'),
  imageDirection: imageDirectionSchema.default({style:'auto',notes:''}),
  contentDirection: contentDirectionSchema.default({style:'auto',audience:'',notes:''}),
})
export type GenerationOptions = z.infer<typeof generationOptionsSchema>
