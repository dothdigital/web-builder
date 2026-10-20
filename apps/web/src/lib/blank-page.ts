import { z } from 'zod'
import { pageSchema, websiteModelSchema, type WebsiteModel } from '@awb/website-model'
import { addContentPage } from './content-creation'
export const blankPageRequestSchema = z.object({
  title: z.string().trim().min(1, 'Enter a page name.').max(200),
  slug: z.string().trim().max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase words separated by hyphens.'),
  addToNavigation: z.boolean().default(true),
})
export type BlankPageRequest = z.infer<typeof blankPageRequestSchema>
export function createBlankPage(model: WebsiteModel, raw: unknown, id: string) {
  const input = blankPageRequestSchema.parse(raw), path = `/${input.slug}`
  if (model.pages.some(page => page.path === path || page.id === id)) throw new Error('That page address already exists. Choose a different URL.')
  const page = pageSchema.parse({ id, path, title: input.title, navLabel: input.title, pageType: 'CUSTOM', h1: input.title, seo: { title: input.title, description: '', canonical: path, index: true }, sections: [] })
  const next = input.addToNavigation ? addContentPage(model,page) : { ...model, pages: [...model.pages,page] }
  return { model: websiteModelSchema.parse(next), pageId: id }
}
