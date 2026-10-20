import type { WebsiteModel } from './model'

export interface PageImageUse {
  pageId: string
  pagePath: string
  sectionId: string
  pointer: string
  url: string
}
export interface RepeatedPageImage { pagePath: string; uses: PageImageUse[] }

// Signed preview URLs and different URL fragments still identify the same asset.
export function imageIdentity(url: string): string {
  return url.trim().split(/[?#]/, 1)[0]!
}

/** Find repeated content images within a page; shared site logos are excluded. */
export function repeatedPageImages(model: WebsiteModel): RepeatedPageImage[] {
  return model.pages.flatMap(page => {
    const groups = new Map<string, PageImageUse[]>()
    for (const section of page.sections) {
      if (section.hidden) continue
      const walk = (value: unknown, pointer = '', removed: string[] = []) => {
        if (!value || typeof value !== 'object') return
        const record = value as Record<string, unknown>
        const exclusions = Array.isArray(record.removedElements) ? [...removed, ...record.removedElements.filter((path): path is string => typeof path === 'string').map(path => pointer + path)] : removed
        for (const [key, child] of Object.entries(record)) {
          if (['elementColors', 'elementOffsets', 'imageSizes', 'flowSlots', 'inlineLinks', 'removedElements'].includes(key)) continue
          if (typeof record.kind === 'string' && record.kind !== 'image' && key === 'imageUrl') continue
          const path = `${pointer}/${key.replace(/~/g, '~0').replace(/\//g, '~1')}`
          if (exclusions.some(removed => path === removed || path.startsWith(removed + '/'))) continue
          if (key === 'sectionBackgroundImageUrl' && record.sectionBackgroundMode !== 'image') continue
          const image = /^(imageUrl|image\d+|backgroundImageUrl|sectionBackgroundImageUrl)$/.test(key) || key === 'url' && /\/images\/\d+\/url$/.test(path)
          if (image && typeof child === 'string' && child.trim()) {
            const identity = imageIdentity(child)
            groups.set(identity, [...(groups.get(identity) ?? []), { pageId: page.id, pagePath: page.path, sectionId: section.id, pointer: path, url: child }])
          } else if (child && typeof child === 'object') walk(child, path, exclusions)
        }
      }
      walk(section.props)
    }
    return [...groups.values()].filter(uses => uses.length > 1).map(uses => ({ pagePath: page.path, uses }))
  })
}

export function assertDistinctPageImages(model: WebsiteModel, baseline?: WebsiteModel): void {
  // Scoped edits may preserve old duplication, but must not introduce new copies.
  const existing = new Set(baseline ? repeatedPageImages(baseline).flatMap(group => group.uses.slice(1).map(use => `${use.pageId}:${use.sectionId}:${use.pointer}:${imageIdentity(use.url)}`)) : [])
  const repeated = repeatedPageImages(model).flatMap(group => group.uses.slice(1)).filter(use => !existing.has(`${use.pageId}:${use.sectionId}:${use.pointer}:${imageIdentity(use.url)}`))
  if (repeated.length) throw new Error(`Repeated content images on ${[...new Set(repeated.map(use => use.pagePath))].join(', ')}. Use distinct section images; do not fill empty image slots by copying another section's image.`)
}
