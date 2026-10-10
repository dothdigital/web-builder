import { getComponent } from '@awb/component-registry'
import type { WebsiteModel, WebsitePage, WebsiteSection } from '@awb/website-model'

const normalize = (value: string) => value.toLowerCase().replace(/&/g, ' and ').replace(/\b(and|the|for|planning|education|savings)\b/g, '').replace(/[^a-z0-9]/g, '')
const imageFor = (page: WebsitePage | undefined) => page?.sections.find((section) => typeof section.props.imageUrl === 'string' && section.props.imageUrl.trim())?.props

function resolveBaseMedia(model: WebsiteModel, page: WebsitePage, section: WebsiteSection): Record<string, unknown> {
  const definition = getComponent(section.componentId)
  const props = { ...section.props }
  if (section.componentId === 'BlogListing') return { ...props, items: model.pages.filter((entry) => entry.pageType === 'BLOG_POST').map((entry) => {
    const cover = imageFor(entry)
    return { title: entry.title, description: entry.seo.description, href: entry.path, imageUrl: cover?.imageUrl, imageAlt: cover?.imageAlt || entry.title }
  }).reverse() }
  if (definition?.family !== 'SERVICES' || !Array.isArray(props.items)) return props

  props.items = props.items.map((item: Record<string, unknown>) => {
    const title = normalize(String(item.title ?? ''))
    const href = typeof item.href === 'string' ? item.href : ''
    const candidates = model.pages.filter((candidate) => candidate.path !== '/')
    const exact = candidates.find((candidate) => candidate.path === href)
      ?? candidates.find((candidate) => normalize(candidate.title) === title || normalize(candidate.path.split('/').pop() ?? '') === title)
    const related = exact ? [exact] : candidates.filter((candidate) => {
      const name = normalize(candidate.title)
      const slug = normalize(candidate.path.split('/').pop() ?? '')
      return title.length > 2 && ((name.length > 3 && title.includes(name)) || (slug.length > 3 && title.includes(slug)))
    })
    // Combined topics link to their shared overview when one exists.
    const parent = related.length > 1 ? candidates.find((candidate) => related.every((child) => child.path.startsWith(`${candidate.path}/`))) : undefined
    const target = exact ?? parent ?? related.sort((a, b) => normalize(b.title).length - normalize(a.title).length)[0]
    const image = imageFor(target)
    return {
      ...item,
      ...(target ? { href: target.path } : {}),
      ...(!item.imageUrl && image ? { imageUrl: image.imageUrl, imageAlt: image.imageAlt || target?.title || page.title } : {}),
    }
  })
  return props
}

// Detached objects need the same image fallbacks as their original section.
// Resolve canonical asset references here; signing/proxying is render-only.
export function resolveSectionMedia(model: WebsiteModel, page: WebsitePage, section: WebsiteSection): Record<string, unknown> {
  const props = resolveBaseMedia(model, page, section)
  if (!Array.isArray(props.freeElements)) return props
  return { ...props, freeElements: props.freeElements.map((entry) => {
    if (!entry || typeof entry !== 'object' || !entry.content || typeof entry.content !== 'object') return entry
    return { ...entry, content: resolveBaseMedia(model, page, { ...section, componentId: entry.componentId, props: entry.content }) }
  }) }
}
