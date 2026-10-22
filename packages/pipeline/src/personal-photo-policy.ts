import { importedSection } from '@awb/component-registry'
import type { WebsiteModel } from '@awb/website-model'

// Page scope is not permission to use a portrait in every section on that page.
export function personalPhotoSection(page: WebsiteModel['pages'][number]): string | undefined {
  const path = page.path.replace(/\/$/, '') || '/'
  if (!['/', '/about', '/about-us', '/team'].includes(path)) return undefined
  const candidates = page.sections.filter(section => {
    if (section.hidden) return false
    const imported = importedSection(section.componentId)
    // Imported inner-page heroes are wide title banners, not biography photos.
    if (imported && imported.family === 'HERO' && path !== '/') return false
    const text = `${section.id} ${section.props.heading ?? ''} ${section.props.eyebrow ?? ''}`
    if (/service|product|approach|process|area|location|benefit|why|gallery|photos|testimonial|contact/i.test(text)) return false
    return imported?.family === 'ABOUT' || path === '/' && imported?.family === 'HERO' || /about|intro|who.we.are|meet|founder|team|biograph/i.test(text) || path === '/' && /hero/i.test(section.id)
  })
  // A home hero introducing the owner takes precedence over a second About portrait.
  return (path === '/' ? candidates.find(section => /hero/i.test(section.id) || importedSection(section.componentId)?.family === 'HERO') : undefined)?.id ?? candidates[0]?.id
}

export function allowsPersonalPhoto(model: WebsiteModel, slot: string): boolean {
  const [pageId, sectionId, pointer] = slot.split(':')
  const page = model.pages.find(page => page.id === pageId)
  return !!page && personalPhotoSection(page) === sectionId && pointer === '/imageUrl'
}

// AI can insert upload URLs before image filling. Remove those that bypass the policy.
export function removeMisplacedPersonalPhotos(model: WebsiteModel, urls: Set<string>): void {
  const clean = (value: unknown, allowed: boolean, root = false): void => {
    if (!value || typeof value !== 'object') return
    for (const [key, item] of Object.entries(value)) {
      if (typeof item === 'string' && urls.has(item) && !(allowed && root && key === 'imageUrl')) {
        const record = value as Record<string, unknown>
        record[key] = ''
        if (key === 'imageUrl') record.imageAlt = ''
        if (key === 'url') record.alt = ''
      } else if (typeof item === 'object') clean(item, false)
    }
  }
  for (const page of model.pages) {
    const intro = personalPhotoSection(page)
    for (const section of page.sections) clean(section.props, section.id === intro, true)
  }
  clean(model.globalComponents, false)
}
