import type { WebsiteModel } from '@awb/website-model'
import { templateServiceLinks } from './imported-layouts'

export function siteChrome(model: WebsiteModel) {
  const header = model.globalComponents.header.props
  const footer = model.globalComponents.footer.props
  const mainPages = model.pages.filter((page) => page.path === '/' || page.path.split('/').filter(Boolean).length === 1).slice(0, 5)
  const label = (page: WebsiteModel['pages'][number]) => page.path === '/' ? 'Home' : page.path === '/contact' ? 'Contact' : page.navLabel || page.title
  const mainLinks = mainPages.map((page) => ({ label: label(page), href: page.path }))
  const infoLinks = model.pages.filter((page) => !mainPages.includes(page)).map((page) => ({ label: label(page), href: page.path }))
  const contact = model.contact
  const address = [contact.addressLine1, contact.addressLine2, contact.city, contact.region, contact.postalCode, contact.country].filter(Boolean).join(', ')
  const existingColumns = Array.isArray(footer.columns) ? footer.columns : []
  const existingItems: Array<{ label: string; href: string; children?: Array<{ label: string; href: string }> }> = Array.isArray(header.items) ? header.items as Array<{ label: string; href: string; children?: Array<{ label: string; href: string }> }> : mainLinks
  // New runs preserve the AI-authored hierarchy. Older flat menus are grouped
  // by their existing parent-page paths without inventing menu labels.
  const grouped = existingItems.some((item) => item.children?.length)
    ? existingItems
    : existingItems.filter((item) => !existingItems.some((parent) => parent.href !== '/' && item.href.startsWith(`${parent.href}/`))).map((item) => ({
        ...item, children: existingItems.filter((child) => item.href !== '/' && child.href.startsWith(`${item.href}/`)),
      }))
  return {
    header: { ...header, email: contact.email || header.email || '', phone: contact.phone || header.phone || '', items: grouped.map(item => {
      if (item.href !== '/services' || item.children?.length) return item
      const services = model.pages.find(page => page.path === '/services')
      const children = services?.sections.filter(section=>!section.hidden).flatMap(section=>templateServiceLinks(section.componentId,section.props)) ?? []
      return { ...item, children }
    }) },
    footer: {
      ...footer,
      tagline: footer.tagline === header.tagline && typeof footer.tagline === 'string' && footer.tagline.length === 160
        ? model.pages.find(page=>page.path==='/')?.seo.description || footer.tagline
        : footer.tagline,
      logoImageUrl: footer.logoImageUrl || header.logoImageUrl,
      columns: existingColumns.length === 2 ? existingColumns : [
        { title: 'Main links', items: mainLinks },
        { title: 'Information', items: [...infoLinks, ...(Array.isArray(footer.legalLinks) ? footer.legalLinks : [])] },
      ],
      address: footer.address || address,
      phone: footer.phone || contact.phone,
      email: footer.email || contact.email,
      socials: model.socials.length ? model.socials.map((social) => ({ platform: social.label || social.network, href: social.url })) : (Array.isArray(footer.socials) ? footer.socials.map((social: { platform?: string; network?: string; href: string }) => ({ platform: social.platform || social.network || 'Social', href: social.href })) : []),
    },
  }
}
