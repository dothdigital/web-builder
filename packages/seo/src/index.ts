import type { WebsiteModel, WebsitePage } from '@awb/website-model'

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function absolute(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/$/, '')}${path === '/' ? '/' : path}`
}

/// Generated from published state only; draft pages never appear.
export function buildSitemapXml(model: WebsiteModel, baseUrl: string, lastModified = new Date()): string {
  const urls = model.pages
    .filter((page) => page.seo.index !== false)
    .map(
      (page) => `  <url>
    <loc>${escapeXml(absolute(baseUrl, page.path))}</loc>
    <lastmod>${lastModified.toISOString().slice(0, 10)}</lastmod>
    <priority>${page.path === '/' ? '1.0' : '0.7'}</priority>
  </url>`,
    )
    .join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`
}

export function buildRobotsTxt(model: WebsiteModel, baseUrl: string): string {
  const disallowAll = model.publishSettings.robotsAllowIndexing === false

  return `User-agent: *
${disallowAll ? 'Disallow: /' : 'Allow: /'}

Sitemap: ${absolute(baseUrl, '/sitemap.xml')}
`
}

/// A plain-language summary of the site for LLM crawlers. This is an emerging
/// convention with no effect on traditional search rankings.
export function buildLlmsTxt(model: WebsiteModel, baseUrl: string): string {
  const pages = model.pages
    .filter((page) => page.seo.index !== false)
    .map((page) => `- [${page.title}](${absolute(baseUrl, page.path)}): ${page.seo.description ?? page.h1}`)
    .join('\n')

  return `# ${model.site.name}

${model.pages.find((page) => page.path === '/')?.seo.description ?? ''}

## Pages

${pages}
`
}

export interface LocalBusinessFacts {
  name: string
  description?: string
  telephone?: string
  email?: string
  streetAddress?: string
  addressLocality?: string
  addressRegion?: string
  postalCode?: string
  addressCountry?: string
  openingHours?: Array<{ day: string; opens: string; closes: string; closed?: boolean }>
  sameAs?: string[]
  image?: string
}

/// Emits schema.org markup strictly from supplied facts. Absent fields are
/// omitted rather than guessed, so structured data can never contradict reality.
export function buildLocalBusinessJsonLd(facts: LocalBusinessFacts, url: string): Record<string, unknown> {
  const address = {
    '@type': 'PostalAddress',
    streetAddress: facts.streetAddress,
    addressLocality: facts.addressLocality,
    addressRegion: facts.addressRegion,
    postalCode: facts.postalCode,
    addressCountry: facts.addressCountry,
  }

  const hasAddress = Object.values(address).some((value, index) => index > 0 && Boolean(value))

  return prune({
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: facts.name,
    description: facts.description,
    url,
    telephone: facts.telephone,
    email: facts.email,
    image: facts.image,
    sameAs: facts.sameAs?.length ? facts.sameAs : undefined,
    address: hasAddress ? prune(address) : undefined,
    openingHoursSpecification: facts.openingHours
      ?.filter((entry) => !entry.closed)
      .map((entry) => ({
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: entry.day,
        opens: entry.opens,
        closes: entry.closes,
      })),
  })
}

export function buildFaqJsonLd(page: WebsitePage): Record<string, unknown> | undefined {
  const items = page.sections.filter((section) => section.componentId === 'FaqAccordion' && !section.hidden).flatMap((section) => {
    const removed = (section.props.removedElements ?? []) as string[]
    if (removed.includes('/layout/0') || removed.includes('/items')) return []
    return ((section.props.items ?? []) as Array<{ question: string; answer: string }>).filter((item, index) => item.question?.trim() && item.answer?.trim() && !removed.some((path) => [`/items/${index}`, `/items/${index}/question`, `/items/${index}/answer`].includes(path)))
  }).filter((item, index, all) => all.findIndex((other) => other.question.trim().toLowerCase() === item.question.trim().toLowerCase()) === index)

  if (items.length === 0) {
    return undefined
  }

  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: { '@type': 'Answer', text: item.answer },
    })),
  }
}

export interface HeadingIssue {
  level: 'error' | 'warning'
  message: string
}

/// Heading structure is part of the SEO contract: exactly one H1, and H3s must
/// sit under an H2.
export function auditHeadings(page: WebsitePage): HeadingIssue[] {
  const issues: HeadingIssue[] = []

  if (!page.h1 || page.h1.trim().length === 0) {
    issues.push({ level: 'error', message: `Page ${page.path} has no H1.` })
  }

  const headings = page.sections
    .filter((section) => !section.hidden)
    .map((section) => (section.props as { heading?: string }).heading)
    .filter((heading): heading is string => Boolean(heading))

  if (headings.length === 0) {
    issues.push({ level: 'warning', message: `Page ${page.path} has no H2 sections.` })
  }

  return issues
}

function prune<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined && entry !== null)) as T
}

export function buildBlogJsonLd(page: WebsitePage, siteUrl: string): Record<string, unknown> | undefined {
  if (page.pageType !== 'BLOG_POST') return undefined
  return {
    '@context': 'https://schema.org', '@type': 'BlogPosting',
    headline: page.h1, description: page.seo.description,
    mainEntityOfPage: new URL(page.seo.canonical ?? page.path, `${siteUrl.replace(/\/$/, '')}/`).href,
    ...(page.contentBrief?.keyword ? { keywords: [page.contentBrief.keyword, page.contentBrief.secondaryKeywords].filter(Boolean).join(', ') } : {}),
  }
}

/// Every public page gets its own identity and breadcrumbs, derived from saved
/// routes and titles rather than AI-invented entities or business claims.
export function buildPageJsonLd(model: WebsiteModel, page: WebsitePage, siteUrl: string): Record<string, unknown> {
  const base = siteUrl.replace(/\/$/, '')
  const url = new URL(page.seo.canonical ?? page.path, `${base}/`).href
  const ancestors = model.pages.filter((candidate) => candidate.path === '/' || (candidate.path !== page.path && page.path.startsWith(`${candidate.path}/`))).sort((a, b) => a.path.length - b.path.length)
  const crumbs = [...ancestors.filter((candidate) => candidate.id !== page.id), page]
  const type = page.pageType === 'BLOG_INDEX' ? 'CollectionPage' : page.path === '/about' ? 'AboutPage' : page.path === '/contact' ? 'ContactPage' : 'WebPage'
  return {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'WebSite', '@id': `${base}/#website`, url: `${base}/`, name: model.site.name },
      { '@type': type, '@id': `${url}#webpage`, url, name: page.seo.title, description: page.seo.description, inLanguage: model.site.locale, isPartOf: { '@id': `${base}/#website` }, breadcrumb: { '@id': `${url}#breadcrumb` } },
      { '@type': 'BreadcrumbList', '@id': `${url}#breadcrumb`, itemListElement: crumbs.map((entry, index) => ({ '@type': 'ListItem', position: index + 1, name: entry.navLabel || entry.title, item: new URL(entry.path, `${base}/`).href })) },
    ],
  }
}
