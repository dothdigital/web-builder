import { resolveContactLinks } from './contact-links'
import { siteChrome } from '@awb/component-registry'
import type { WebsiteModel } from '@awb/website-model'
import { resolveSectionMedia } from './section-media'

// Render-only copy: editor history and saved models retain canonical asset URLs.
export function resolveEditorMedia(model: WebsiteModel, urls: Record<string, string>): WebsiteModel {
  model = resolveContactLinks(model)
  function rewrite(value: unknown): unknown {
    if (typeof value === 'string') return urls[value] ?? value
    if (Array.isArray(value)) return value.map(rewrite)
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, rewrite(entry)]))
    return value
  }
  const chrome = siteChrome(model)
  return rewrite({ ...model, globalComponents: { header: { ...model.globalComponents.header, props: chrome.header }, footer: { ...model.globalComponents.footer, props: chrome.footer } }, pages: model.pages.map((page) => ({ ...page, sections: page.sections.map((section) => ({ ...section, props: resolveSectionMedia(model, page, section) })) })) }) as WebsiteModel
}
