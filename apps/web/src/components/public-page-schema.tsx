import { PUBLIC_PAGES, SITE_DESCRIPTION, SITE_URL } from '@/lib/seo'
import { websiteBuilderPage } from '@/lib/seo-landings'

export function PublicPageSchema({ path, title, description }: { path: string; title?: string; description?: string }) {
  const page = PUBLIC_PAGES[path as keyof typeof PUBLIC_PAGES] || websiteBuilderPage(path.slice(1))
  const url = SITE_URL + path
  const name = title || page?.title || 'Webtummy'
  const summary = description || page?.description || SITE_DESCRIPTION
  const graph: Record<string, unknown>[] = [{
    '@type': path === '/contact' ? 'ContactPage' : path === '/about-us' ? 'AboutPage' : 'WebPage',
    '@id': `${url}#webpage`, url, name, description: summary, inLanguage: 'en',
    isPartOf: { '@id': `${SITE_URL}/#website` },
    about: { '@id': `${SITE_URL}/#organization` },
    ...(path !== '/' ? { breadcrumb: { '@id': `${url}#breadcrumb` } } : {}),
  }]
  if (path === '/') {
    graph.push({
      '@type': 'Organization', '@id': `${SITE_URL}/#organization`, name: 'Webtummy', url: `${SITE_URL}/`,
      description: SITE_DESCRIPTION, logo: `${SITE_URL}/logo.png`, email: 'info@webtummy.com',
      sameAs: ['https://www.facebook.com/webtummy'], areaServed: 'Worldwide',
    }, {
      '@type': 'WebSite', '@id': `${SITE_URL}/#website`, name: 'Webtummy', url: `${SITE_URL}/`,
      description: SITE_DESCRIPTION, inLanguage: 'en', publisher: { '@id': `${SITE_URL}/#organization` },
    }, {
      '@type': 'WebApplication', '@id': `${SITE_URL}/#application`, name: 'Webtummy',
      url: `${SITE_URL}/`, applicationCategory: 'BusinessApplication', operatingSystem: 'Web browser',
      description: SITE_DESCRIPTION, provider: { '@id': `${SITE_URL}/#organization` },
      featureList: ['AI website creation', 'Visual website editor', 'SEO tools', 'AI content creation', 'Managed hosting', 'Custom domains'],
      offers: { '@type': 'Offer', url: `${SITE_URL}/pricing`, price: '29', priceCurrency: 'USD', description: 'US$29 per month for one website. Eligible new customers get a 7-day free trial. Card required.' },
    })
  } else {
    const crumbs = [{ '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/` }]
    if (path.startsWith('/support/')) crumbs.push({ '@type': 'ListItem', position: 2, name: 'Help center', item: `${SITE_URL}/support` })
    crumbs.push({ '@type': 'ListItem', position: crumbs.length + 1, name: title || page?.label || name, item: url })
    graph.push({ '@type': 'BreadcrumbList', '@id': `${url}#breadcrumb`, itemListElement: crumbs })
  }
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }).replace(/</g, '\\u003c') }} />
}
