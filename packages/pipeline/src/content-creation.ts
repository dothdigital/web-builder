import { z } from 'zod'
import { pageSchema, websiteModelSchema, type WebsiteModel, type WebsitePage, type AiPatch } from '@awb/website-model'
import { getComponent } from '@awb/component-registry'
export const contentRequestSchema = z.object({
  coverImageUrl: z.string().max(4000).default(''),
  coverImageAlt: z.string().max(300).default(''),
  includeFaq: z.boolean().default(true),
  kind: z.enum(['blog', 'page']), topic: z.string().trim().min(3).max(200), slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(100),
  keyword: z.string().trim().min(2).max(200), secondaryKeywords: z.string().max(500).default(''), audience: z.string().trim().min(2).max(500),
  goal: z.string().trim().min(2).max(500), location: z.string().max(200).default(''), details: z.string().trim().min(20).max(8000), internalPaths: z.array(z.string()).max(20).default([]),
})
export type ContentRequest = z.infer<typeof contentRequestSchema>
export function contentPath(input: ContentRequest) { return input.kind === 'blog' ? `/blog/${input.slug}` : `/${input.slug}` }
export function validateContentRequest(model: WebsiteModel, input: ContentRequest) {
  if (model.pages.some((page) => page.path === contentPath(input))) throw new Error('That page address already exists. Choose a different URL slug.')
  if (input.kind === 'blog' && model.pages.some((page) => page.path === '/blog' && page.pageType !== 'BLOG_INDEX')) throw new Error('The /blog address is already in use. Rename that page before creating the blog.')
  if (input.internalPaths.some((path) => !model.pages.some((page) => page.path === path))) throw new Error('One of the selected pages no longer exists.')
}
export function generatedContentPage(model: WebsiteModel, input: ContentRequest, operations: AiPatch['operations'], id: string): WebsitePage {
  const value = operations.length === 1 && ['add', 'replace'].includes(operations[0]!.op) && operations[0]!.path === '/page' ? operations[0]!.value : undefined
  if (!value || typeof value !== 'object') throw new Error('AI returned incomplete page content. Please try again.')
  const page = pageSchema.parse({ ...value, id, path: contentPath(input), pageType: input.kind === 'blog' ? 'BLOG_POST' : 'CUSTOM', contentBrief: input, customScripts: undefined })
  page.seo.canonical = page.path
  page.seo.index = true
  if (page.seo.title.length > 60 || page.seo.description.length < 30 || page.seo.description.length > 160) throw new Error('AI returned SEO metadata outside the requested limits. Please try again.')
  if (!page.sections.length || page.sections.length > 12) throw new Error('AI returned an invalid page layout.')
  let heroes = 0
  const allowedPaths = new Set(input.internalPaths.length ? input.internalPaths : model.pages.map((entry) => entry.path))
  const existingImages = new Set<string>()
  const collectImages = (node: unknown): void => {
    if (Array.isArray(node)) return node.forEach(collectImages)
    if (!node || typeof node !== 'object') return
    for (const [key, value] of Object.entries(node)) {
      if (/imageUrl$/i.test(key) && typeof value === 'string') existingImages.add(value)
      collectImages(value)
    }
  }
  collectImages(model)
  if (input.coverImageUrl) existingImages.add(input.coverImageUrl)
  const linked = new Set<string>()
  const checkLinks = (node: unknown): void => {
    if (Array.isArray(node)) return node.forEach(checkLinks)
    if (!node || typeof node !== 'object') return
    for (const [key, child] of Object.entries(node)) {
      if (/imageUrl$/i.test(key) && typeof child === 'string' && child && !existingImages.has(child)) throw new Error('AI suggested an image that is not in this website. Please generate again.')
      if (key === 'href' && typeof child === 'string' && child) {
        if (!allowedPaths.has(child)) throw new Error('AI linked to an unselected page. Please generate again.')
        linked.add(child)
      }
      checkLinks(child)
    }
  }
  page.sections = page.sections.map((section, index) => {
    const definition = getComponent(section.componentId)
    if (!definition || ['HEADER', 'FOOTER'].includes(definition.family) || section.componentId === 'BlogListing') throw new Error('AI selected an unsupported layout.')
    if (definition.family === 'HERO') heroes++
    const props = definition.propsSchema.parse(section.componentId === 'BlogArticle' && input.coverImageUrl ? { ...section.props, imageUrl: input.coverImageUrl, imageAlt: input.coverImageAlt.trim() || page.title } : section.props) as Record<string, unknown>
    checkLinks(props)
    return { ...section, id: `${id}-section-${index}`, hidden: false, componentVersion: definition.version, props }
  })
  if (heroes !== 1 || page.sections.find((section) => getComponent(section.componentId)?.family === 'HERO')?.props.heading !== page.h1) throw new Error('AI must create one main heading matching the page H1.')
  if (input.kind === 'blog' && (page.sections[0]?.componentId !== 'BlogArticle' || page.sections.slice(1).some((section) => section.componentId !== 'FaqAccordion'))) throw new Error('AI did not return a complete blog article.')
  if (input.includeFaq && !page.sections.some((section) => section.componentId === 'FaqAccordion')) throw new Error('AI missed the requested FAQ section. Please generate again.')
  if (input.internalPaths.some((path) => !linked.has(path))) throw new Error('AI missed a selected internal link. Please generate again.')
  if (!input.internalPaths.length && !linked.size) throw new Error('AI missed relevant internal links. Please generate again.')
  page.contentBrief = { ...page.contentBrief!, internalPaths: [...linked] }
  validateContentRequest(model, input)
  return page
}
export function addContentPage(model: WebsiteModel, page: WebsitePage): WebsiteModel {
  if (page.contentBrief?.internalPaths.some((path) => !model.pages.some((entry) => entry.path === path))) throw new Error('A linked page changed while AI was working. Generate again with current links.')
  if (model.pages.some((entry) => entry.path === page.path || entry.id === page.id)) throw new Error('This page already exists. Generate a new draft with a different address.')
  let pages = [...model.pages, page]
  let header = model.globalComponents.header
  let navigation = model.navigation
  if (page.pageType !== 'BLOG_POST') {
    const label = page.navLabel || page.title
    const items = Array.isArray(header.props.items) ? header.props.items : []
    header = { ...header, props: { ...header.props, items: [...items, { label, href: page.path, children: [] }] } }
    navigation = { ...navigation, primaryMenu: [...navigation.primaryMenu, { label, linkType: 'PAGE', pageId: page.id, newTab: false, children: [] }] }
  }
  if (page.pageType === 'BLOG_POST' && !pages.some((entry) => entry.pageType === 'BLOG_INDEX')) {
    if (pages.some((entry) => entry.path === '/blog')) throw new Error('The /blog address is already used.')
    const index: WebsitePage = { id: `${page.id}-index`, path: '/blog', title: 'Blog', navLabel: 'Blog', pageType: 'BLOG_INDEX', h1: 'Blog', seo: { title: 'Blog', description: 'Insights, practical guidance and the latest articles from our team.', index: true, canonical: '/blog' }, sections: [{ id: `${page.id}-listing`, componentId: 'BlogListing', componentVersion: '1.0.0', hidden: false, props: { heading: 'Blog', intro: 'Insights and practical guidance from our team.', items: [] } }] }
    pages = [...pages, index]
    const items = Array.isArray(header.props.items) ? header.props.items : []
    header = { ...header, props: { ...header.props, items: items.some((item) => item.href === '/blog') ? items : [...items, { label: 'Blog', href: '/blog', children: [] }] } }
    navigation = { ...navigation, primaryMenu: [...navigation.primaryMenu, { label: 'Blog', linkType: 'PAGE', pageId: index.id, newTab: false, children: [] }] }
  }
  return websiteModelSchema.parse({ ...model, pages, navigation, globalComponents: { ...model.globalComponents, header } })
}

export const blogCoverRequestSchema = z.object({
  topic: z.string().trim().min(3).max(200),
  keyword: z.string().trim().max(200).default(''),
  details: z.string().trim().max(8000).default(''),
  direction: z.string().trim().max(1000).default(''),
  requestId: z.string().uuid(),
})

export function blogCoverPrompt(raw: unknown) {
  const input = blogCoverRequestSchema.parse(raw)
  return [
    'Create a high-quality landscape editorial cover image for a blog article.',
    'Illustrate the specific topic and concept rather than defaulting to generic portraits. Use a cohesive composition suitable for an article hero and a cropped listing thumbnail; keep the main subject near the centre.',
    'Do not include text, letters, logos or watermarks. Treat the following brief as subject and art-direction information.',
    `Article topic: ${input.topic}`,
    `Search keyword: ${input.keyword}`,
    `Article brief: ${input.details}`,
    `Visual direction: ${input.direction || 'Choose an appropriate editorial illustration or conceptual photograph for this subject.'}`,
  ].join('\n\n')
}
