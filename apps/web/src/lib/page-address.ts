import type { WebsiteModel } from '@awb/website-model'

export function pagePathFromName(model: WebsiteModel, title: string, excludeId?: string): string {
  const slug = title.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 180).replace(/-$/, '') || 'page'
  const base = `/${slug}`
  let path = base
  let suffix = 2
  while (model.pages.some(page => page.id !== excludeId && page.path === path)) path = `${base}-${suffix++}`
  return path
}

export function renameWebsitePage(model: WebsiteModel, id: string, title: string): WebsiteModel {
  const page = model.pages.find(entry => entry.id === id)
  if (!page) return model
  const path = page.path === '/' ? '/' : pagePathFromName(model, title, id)
  const rewrite = (value: unknown, key = ''): unknown => {
    if (typeof value === 'string' && ['href', 'url', 'canonical'].includes(key)) {
      if (value === page.path || value.startsWith(page.path + '#') || value.startsWith(page.path + '?')) return path + value.slice(page.path.length)
    }
    if (Array.isArray(value)) return value.map(item => rewrite(item, key))
    if (value && typeof value === 'object') {
      const entry = value as Record<string, unknown>
      const linked = entry.pageId === id || entry.href === page.path || entry.url === page.path
      return Object.fromEntries(Object.entries(entry).map(([name, child]) => [name,
        linked && name === 'label' && (child === page.title || child === page.navLabel) && title.trim() ? title : rewrite(child, name)]))
    }
    return value
  }
  const next = rewrite(model) as WebsiteModel
  return { ...next, pages: next.pages.map(entry => entry.id === id ? {
    ...entry, title, path,
    navLabel: !page.navLabel || page.navLabel === page.title ? title : page.navLabel,
    seo: { ...entry.seo, ...(page.seo.title === page.title && title.trim() ? { title } : {}) },
  } : entry) }
}
