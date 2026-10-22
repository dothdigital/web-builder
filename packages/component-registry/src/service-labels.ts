import { formatServiceLabel, type WebsiteModel } from '@awb/website-model'
import { getComponent } from './registry'

export function normalizeServiceLabels(source: WebsiteModel): WebsiteModel {
  const servicePages = source.pages.filter(page => page.pageType === 'SERVICE' || page.path.startsWith('/services/'))
  const key = (value: string) => value.trim().replace(/\s+/g, ' ').toLowerCase()
  const names = new Map(servicePages.flatMap(page => [page.title, page.navLabel].filter((value): value is string => Boolean(value)).map(value => [key(value), formatServiceLabel(value)])))
  const ids = new Set(servicePages.map(page => page.id))
  const routes = servicePages.map(page => page.path)
  const labelKeys = new Set(['title', 'navLabel', 'label', 'name', 'heading', 'h1'])
  function rewrite(value: unknown, field = ''): unknown {
    if (typeof value === 'string') return (labelKeys.has(field) || /^text\d+$/.test(field)) ? names.get(key(value)) ?? value : value
    if (Array.isArray(value)) return value.map(item => rewrite(item, field))
    if (!value || typeof value !== 'object') return value
    const record = value as Record<string, unknown>
    const result = Object.fromEntries(Object.entries(record).map(([name, item]) => [name, rewrite(item, name)]))
    const href = typeof record.href === 'string' ? record.href.split(/[?#]/)[0]! : ''
    if (ids.has(String(record.pageId)) || routes.some(route => href === route || href.endsWith(route))) {
      if (typeof record.label === 'string') result.label = formatServiceLabel(record.label)
    }
    return result
  }
  const model = rewrite(source) as WebsiteModel
  for (const page of model.pages) {
    if (ids.has(page.id)) {
      page.title = formatServiceLabel(page.title)
      if (page.navLabel) page.navLabel = formatServiceLabel(page.navLabel)
    }
    for (const section of page.sections) {
      const definition = getComponent(section.componentId)
      if (definition?.family !== 'SERVICES') continue
      const headingKeys = new Set(['heading', ...definition.editorFields.filter(field => field.headingLevel).map(field => field.path.slice(1))])
      for (const name of headingKeys) if (typeof section.props[name] === 'string') section.props[name] = formatServiceLabel(section.props[name] as string)
      if (Array.isArray(section.props.items)) section.props.items = section.props.items.map(item => {
        if (!item || typeof item !== 'object') return item
        return { ...item, ...Object.fromEntries(['title', 'name', 'label'].filter(name => typeof item[name] === 'string').map(name => [name, formatServiceLabel(item[name])])) }
      })
    }
  }
  return model
}
