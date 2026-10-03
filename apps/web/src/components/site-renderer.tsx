import { resolveContactLinks } from '../lib/contact-links'
import { resolveSectionMedia } from '../lib/section-media'
import { getComponent, tokensToCssVars, siteChrome } from '@awb/component-registry'
import type { RenderContext } from '@awb/component-registry'
import type { WebsiteModel, WebsitePage } from '@awb/website-model'

function RenderSection({
  componentId,
  props,
  context,
  sectionId,
  selectable,
}: {
  componentId: string
  props: Record<string, unknown>
  context: RenderContext
  sectionId?: string
  selectable?: boolean
}) {
  const definition = getComponent(componentId)

  if (!definition) {
    /// Unknown components are skipped rather than rendered: only registry
    /// components are ever allowed onto a page.
    return null
  }

  const parsed = definition.propsSchema.safeParse(props)

  if (!parsed.success) {
    return null
  }

  const Component = definition.render

  return (
    <div style={definition.family === 'HEADER' && (parsed.data as { sticky?: boolean }).sticky ? { position: 'sticky', top: 0, zIndex: 50 } : undefined} id={sectionId} data-section-id={sectionId} data-component-id={componentId} data-selectable={selectable ? 'true' : undefined}>
      <Component props={parsed.data} context={context} />
    </div>
  )
}

export function SiteRenderer({
  model: sourceModel,
  page: sourcePage,
  baseUrl,
  editing = false,
  staticExport = false,
  forms,
}: {
  model: WebsiteModel
  page: WebsitePage
  baseUrl: string
  editing?: boolean
  staticExport?: boolean
  forms?: RenderContext['forms']
}) {
  const model = resolveContactLinks(sourceModel)
  const page = model.pages.find((entry) => entry.id === sourcePage.id) ?? sourcePage
  const chrome = siteChrome(model)
  const sectionProps = (section: WebsitePage['sections'][number]) => {
    const props = resolveSectionMedia(model, page, section)
    const rewriteLinks = (value: unknown): unknown => {
      if (Array.isArray(value)) return value.map(rewriteLinks)
      if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, key === 'href' && typeof entry === 'string' && entry.startsWith('/') && !entry.startsWith('//') ? `${baseUrl}${entry}` : rewriteLinks(entry)]))
      return value
    }
    return rewriteLinks(props) as Record<string, unknown>
  }
  const context: RenderContext = { tokens: model.tokens, baseUrl, editing, forms }

  return (
    <div style={{ ...tokensToCssVars(model.tokens), background: 'var(--awb-bg)', color: 'var(--awb-fg)' }}>
      <RenderSection
        componentId={model.globalComponents.header.componentId}
        props={chrome.header}
        context={{ ...context, staticRenderScope: staticExport ? 'header' : undefined }}
      />
      <main>
        {page.sections
          .filter((section) => !section.hidden)
          .map((section) => (
            <RenderSection
              key={section.id}
              sectionId={section.id}
              componentId={section.componentId}
              props={sectionProps(section)}
              context={{ ...context, staticRenderScope: staticExport ? `section-${section.id}` : undefined }}
              selectable={editing}
            />
          ))}
      </main>
      <RenderSection
        componentId={model.globalComponents.footer.componentId}
        props={chrome.footer}
        context={{ ...context, staticRenderScope: staticExport ? 'footer' : undefined }}
      />
    </div>
  )
}
