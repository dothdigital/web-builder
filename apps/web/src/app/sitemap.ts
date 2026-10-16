import type { MetadataRoute } from 'next'
import { PUBLIC_PAGES, SITE_URL } from '@/lib/seo'
import { guides } from './support/guides'
import { WEBSITE_BUILDER_PAGES } from '@/lib/seo-landings'

export default function sitemap(): MetadataRoute.Sitemap {
  // Only canonical, public pages belong here. Do not invent modification dates.
  return [
    ...Object.keys(PUBLIC_PAGES).map(path => ({ url: SITE_URL + path })),
    ...WEBSITE_BUILDER_PAGES.map(page => ({ url: `${SITE_URL}/${page.slug}` })),
    ...guides.map(guide => ({ url: `${SITE_URL}/support/${guide.slug}` })),
  ]
}
