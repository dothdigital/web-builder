import type { WebsiteModel } from '@awb/website-model'

export function contactRoute(model: WebsiteModel): string | undefined {
  return model.pages.find((page) => page.path === '/contact')?.path
    ?? model.pages.find((page) => page.path === '/request-a-quote')?.path
}

export function resolveContactLinks(model: WebsiteModel): WebsiteModel {
  const route = contactRoute(model)
  if (!route || route === '/contact') return model
  const targetRoute: string = route
  function rewrite(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(rewrite)
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, key === 'href' && typeof entry === 'string' && /^\/contact(?=$|[?#])/.test(entry) ? entry.replace('/contact', targetRoute) : rewrite(entry)]))
    return value
  }
  return rewrite(model) as WebsiteModel
}
