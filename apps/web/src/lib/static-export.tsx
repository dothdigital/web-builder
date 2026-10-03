import { websiteTracker } from './website-tracker'
import { HEADER_MENU_SCRIPT } from './header-menu-script'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import type { ReactElement } from 'react'
import JSZip from 'jszip'
import { tokensToCssVars } from '@awb/component-registry'
import { buildPageJsonLd, buildBlogJsonLd, buildFaqJsonLd, buildLlmsTxt, buildLocalBusinessJsonLd, buildRobotsTxt, buildSitemapXml } from '@awb/seo'
import { localUploadRoot } from '@awb/shared'
import type { WebsiteModel, WebsitePage } from '@awb/website-model'
import { SiteRenderer } from '../components/site-renderer'

/// Placeholder written into the markup while rendering, then replaced per page
/// with the relative path back to the export root so the archive works when
/// opened straight from disk as well as when uploaded to any host.
const ROOT_TOKEN = '__AWB_EXPORT_ROOT__'

interface ExportFile {
  path: string
  body: string | Buffer
}

export interface StaticExportOptions {
  /// Absolute site URL used for canonicals, sitemap and Open Graph tags.
  siteUrl: string
  forms?: import('@awb/component-registry').RenderContext['forms']
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function scriptJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026')
}

function pageFilePath(page: WebsitePage): string {
  const clean = page.path.replace(/^\/+|\/+$/g, '')
  if (clean.split('/').some((segment) => segment === '..' || segment === '.') || clean.includes('\\')) {
    throw new Error('Invalid export page path')
  }
  return clean.length === 0 ? 'index.html' : `${clean}/index.html`
}

function relativeRoot(filePath: string): string {
  const depth = filePath.split('/').length - 1
  return depth === 0 ? './' : '../'.repeat(depth)
}

function collectImageUrls(model: WebsiteModel): string[] {
  const found = new Set<string>()

  const walk = (value: unknown): void => {
    if (typeof value === 'string') {
      if (/^(\/uploads\/|https?:\/\/)/.test(value) && /\.(png|jpe?g|webp|avif|gif|svg)(\?|$)/i.test(value)) {
        found.add(value)
      }

      return
    }

    if (Array.isArray(value)) {
      value.forEach(walk)
      return
    }

    if (value && typeof value === 'object') {
      Object.values(value as Record<string, unknown>).forEach(walk)
    }
  }

  walk(model)

  return [...found]
}

export class ExportAssetError extends Error {}

async function readAsset(url: string): Promise<Buffer> {
  try {
    if (url.startsWith('/uploads/')) {
      const root = path.resolve(localUploadRoot())
      const target = path.resolve(root, url.slice('/uploads/'.length))
      if (!target.startsWith(`${root}${path.sep}`)) throw new Error('Invalid asset path')
      return await readFile(target)
    }
    const response = await fetch(url, { signal: AbortSignal.timeout(30000) })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const body = Buffer.from(await response.arrayBuffer())
    if (body.length === 0) throw new Error('Empty image')
    return body
  } catch {
    // Do not expose signed URL credentials or return an archive with broken images.
    throw new ExportAssetError(`Could not include image "${exportFileName(url, 0)}". Please retry the export or replace the unavailable image.`)
  }
}

function exportFileName(url: string, index: number): string {
  const base = url.split('?')[0]?.split('/').pop() ?? `image-${index}`
  const safe = base.replace(/[^a-z0-9.-]+/gi, '-').toLowerCase()

  return safe.includes('.') ? safe : `${safe}.png`
}

/// Downloads every referenced image into the archive and rewrites the model so
/// the exported HTML points at the bundled copies instead of the platform.
async function bundleImages(model: WebsiteModel): Promise<{ model: WebsiteModel; files: ExportFile[] }> {
  const urls = collectImageUrls(model)
  const files: ExportFile[] = []
  const rewrites = new Map<string, string>()

  for (const [index, url] of urls.entries()) {
    const body = await readAsset(url)

    const name = `${index}-${exportFileName(url, index)}`
    files.push({ path: `assets/images/${name}`, body })
    rewrites.set(url, `${ROOT_TOKEN}assets/images/${name}`)
  }

  function rewrite(value: unknown): unknown {
    if (typeof value === 'string') return rewrites.get(value) ?? value
    if (Array.isArray(value)) return value.map(rewrite)
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, rewrite(entry)]))
    return value
  }
  return { model: rewrite(model) as WebsiteModel, files }
}

function buildStylesheet(model: WebsiteModel): string {
  const vars = tokensToCssVars(model.tokens) as Record<string, string>
  const declarations = Object.entries(vars)
    .map(([name, value]) => `  ${name}: ${value};`)
    .join('\n')

  return `:root {
${declarations}
}

*, *::before, *::after { box-sizing: border-box; }

html { scroll-behavior: smooth; }

body {
  margin: 0;
  background: var(--awb-bg);
  color: var(--awb-fg);
  font-family: var(--awb-body-font);
  font-size: var(--awb-base-size);
  -webkit-font-smoothing: antialiased;
}

img { max-width: 100%; }

a { color: inherit; }
`
}

function headTags(model: WebsiteModel, page: WebsitePage, options: StaticExportOptions, root: string): string {
  const siteUrl = options.siteUrl.replace(/\/$/, '')
  const canonical = new URL(page.seo.canonical ?? page.path, `${siteUrl}/`).href
  const title = page.seo.title?.trim() || `${page.title} | ${model.site.name}`
  const description = page.seo.description ?? ''
  const faq = buildFaqJsonLd(page)
  const article = buildBlogJsonLd(page, siteUrl)
  const business = buildLocalBusinessJsonLd(
    {
      name: model.site.name,
      ...(model.pages[0]?.seo.description ? { description: model.pages[0].seo.description } : {}),
      ...(model.contact.phone ? { telephone: model.contact.phone } : {}),
      ...(model.contact.email ? { email: model.contact.email } : {}),
      ...(model.contact.addressLine1 ? { streetAddress: model.contact.addressLine1 } : {}),
      ...(model.contact.city ? { addressLocality: model.contact.city } : {}),
      ...(model.contact.region ? { addressRegion: model.contact.region } : {}),
      ...(model.contact.postalCode ? { postalCode: model.contact.postalCode } : {}),
      ...(model.contact.country ? { addressCountry: model.contact.country } : {}),
      openingHours: model.contact.hours,
      sameAs: [
        ...model.socials.map((social) => social.url),
        ...(model.google.businessProfileUrl ? [model.google.businessProfileUrl] : []),
        ...(model.google.mapsUrl ? [model.google.mapsUrl] : []),
      ],
    },
    `${siteUrl}/`,
  )

  const ga4 = model.analyticsSettings.ga4MeasurementId
  const analytics = ga4 && /^G-[A-Z0-9]+$/.test(ga4)
    ? `<script async src="https://www.googletagmanager.com/gtag/js?id=${escapeHtml(ga4)}"></script>
    <script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config',${scriptJson(ga4)});</script>`
    : ''

  return `<meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    ${description ? `<meta name="description" content="${escapeHtml(description)}" />` : ''}
    <link rel="canonical" href="${escapeHtml(canonical)}" />
    ${page.seo.index === false ? '<meta name="robots" content="noindex,nofollow" />' : ''}
    ${model.google.searchConsoleVerification ? `<meta name="google-site-verification" content="${escapeHtml(model.google.searchConsoleVerification)}" />` : ''}
    <meta property="og:type" content="${article ? 'article' : 'website'}" />
    <meta property="og:title" content="${escapeHtml(title)}" />
    ${description ? `<meta property="og:description" content="${escapeHtml(description)}" />` : ''}
    <meta property="og:url" content="${escapeHtml(canonical)}" />
    <meta name="twitter:card" content="summary_large_image" />
    <link rel="stylesheet" href="${root}assets/site.css" />
    <script type="application/ld+json">${scriptJson(buildPageJsonLd(model, page, siteUrl))}</script>
    <script type="application/ld+json">${scriptJson(business)}</script>
    ${faq ? `<script type="application/ld+json">${scriptJson(faq)}</script>` : ''}
    ${article ? `<script type="application/ld+json">${scriptJson(article)}</script>` : ''}
    ${analytics}`
}

/// Internal links are absolute in the model; the archive is a folder of static
/// files, so they are rewritten to the matching `<path>/index.html`.
function rewriteLinks(html: string, model: WebsiteModel, root: string): string {
  return html.replace(/href="(\/[^"#?]*)"/g, (match, href: string) => {
    const normalized = href.replace(/\/$/, '') || '/'
    const page = model.pages.find((candidate) => candidate.path === normalized)

    if (!page) {
      return match
    }

    return `href="${root}${pageFilePath(page)}"`
  })
}

/// Imported lazily: Next.js rejects a static `react-dom/server` import in app
/// code, and the export is the one place that legitimately needs it.
async function renderMarkup(element: ReactElement): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server')

  return renderToStaticMarkup(element)
}

async function renderPage(
  model: WebsiteModel,
  page: WebsitePage,
  options: StaticExportOptions,
): Promise<string> {
  const filePath = pageFilePath(page)
  const root = relativeRoot(filePath)
  const body = await renderMarkup(<SiteRenderer model={model} page={page} baseUrl="" forms={options.forms} staticExport />)

  const html = `<!doctype html>
<html lang="${escapeHtml(model.site.locale)}">
  <head>
    ${headTags(model, page, options, root)}
    ${model.customScripts?.head ?? ''}
    ${page.customScripts?.head ?? ''}
  </head>
  <body>
    ${body}
    <script>${HEADER_MENU_SCRIPT}</script>
    ${options.forms ? `<script>${websiteTracker(options.forms.projectId, new URL('/api/visits', options.forms.action).href)}</script>` : ''}
    ${options.forms?.recaptchaSiteKey ? '<script>window.awbRecaptchaReady=function(){document.querySelectorAll(".g-recaptcha").forEach(function(el){if(!el.childNodes.length)grecaptcha.render(el,{sitekey:el.dataset.sitekey});});};</script><script src="https://www.google.com/recaptcha/api.js?onload=awbRecaptchaReady&amp;render=explicit" async defer></script>' : ''}
    ${model.customScripts?.bodyEnd ?? ''}
    ${page.customScripts?.bodyEnd ?? ''}
  </body>
</html>
`

  return rewriteLinks(html, model, root).split(ROOT_TOKEN).join(root)
}

export async function buildStaticExport(
  source: WebsiteModel,
  options: StaticExportOptions,
): Promise<Buffer> {
  const { model, files } = await bundleImages(source)
  const zip = new JSZip()

  for (const file of files) {
    zip.file(file.path, file.body)
  }

  zip.file('assets/site.css', buildStylesheet(model))

  for (const page of model.pages) {
    zip.file(pageFilePath(page), await renderPage(model, page, options))
  }

  zip.file('sitemap.xml', buildSitemapXml(model, options.siteUrl))
  zip.file('robots.txt', buildRobotsTxt(model, options.siteUrl))
  zip.file('llms.txt', buildLlmsTxt(model, options.siteUrl))
  zip.file(
    'README.txt',
    `${model.site.name} — static export

Upload the contents of this folder to any static host (S3, Netlify, Nginx).
Pages are plain HTML, styling lives in assets/site.css and every image is
bundled under assets/images. Canonical URLs were generated for ${options.siteUrl};
regenerate the export after changing the domain.
${options.forms ? `Contact forms submit to ${options.forms.action}. Keep this server online. A localhost endpoint only works on the developer machine; export from the public builder before deploying. Configure the website domain in the builder and Google reCAPTCHA when enabling form protection.` : 'Contact forms require a backend endpoint.'}
Global and page custom scripts execute in this export. reCAPTCHA secret keys are not included.
`,
  )

  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
}
