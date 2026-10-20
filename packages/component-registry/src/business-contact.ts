import type { WebsiteModel, WebsiteSection } from '@awb/website-model'
import { getComponent } from './registry'
import { importedSection } from './imported-layouts'
import type { BusinessContactDetailsValue } from './components/business-contact-details'

/** Resolve supplied facts at render time, so existing sites and every output stay in sync. */
export function resolveBusinessContact(model: WebsiteModel): WebsiteModel {
  const contact = model.contact
  if (!contact) return model
  if (!model.businessDetails && !Object.entries(contact).some(([key, value]) => key !== 'hours' && Boolean(value)) && !model.socials.length) return model
  const details: BusinessContactDetailsValue = {
    address: [contact.addressLine1, contact.addressLine2, contact.city, contact.region, contact.postalCode, contact.country].filter(Boolean).join(', '),
    emails: (contact.emails ?? (contact.email ? [contact.email] : [])).filter(value => value.trim()),
    phones: (contact.phones ?? (contact.phone ? [contact.phone] : [])).filter(value => value.trim()),
    socials: model.socials.filter(social => /^https?:\/\//i.test(social.url)).map(social => ({ platform: social.network, href: social.url })),
    hours: contact.hours.map(hour => ({ day: hour.day, value: hour.closed ? 'Closed' : `${hour.opens} – ${hour.closes}` })),
  }
  const primaryEmail = details.emails[0] ?? '', primaryPhone = details.phones[0] ?? ''
  function resolveLinks(value: unknown): unknown {
    if (typeof value === 'string') {
      if (/^mailto:/i.test(value)) {
        const [email, ...query] = value.slice(7).split('?')
        if (details.emails.includes(email!)) return value
        return primaryEmail ? `mailto:${primaryEmail}${query.length ? '?' + query.join('?') : ''}` : '/contact'
      }
      if (/^tel:/i.test(value)) {
        if (details.phones.some(phone => phone.replace(/[^\d+]/g, '') === value.slice(4).replace(/[^\d+]/g, ''))) return value
        return primaryPhone ? `tel:${primaryPhone}` : '/contact'
      }
      return value
    }
    if (Array.isArray(value)) return value.map(resolveLinks)
    if (value && typeof value === 'object') {
      const record = value as Record<string, unknown>
      const link = typeof record.href === 'string' ? record.href : typeof record.url === 'string' ? record.url : ''
      const oldValue = link.replace(/^(mailto:|tel:)/i, '')
      const resolved = resolveLinks(link) as string
      const replacement = /^(mailto:|tel:)/i.test(link) && resolved !== link ? resolved === '/contact' ? '' : resolved.replace(/^(mailto:|tel:)/i, '').split('?')[0] : undefined
      return Object.fromEntries(Object.entries(record).map(([key, item]) => [key, replacement !== undefined && typeof item === 'string' && ['label', 'text'].includes(key) && item === oldValue ? replacement : resolveLinks(item)]))
    }
    return value
  }
  function resolveProps(componentId: string, original: Record<string, unknown>, showDetails = false): Record<string, unknown> {
    const family = getComponent(componentId)?.family
    const props = resolveLinks(original) as Record<string, unknown>
    if (['HEADER', 'FOOTER', 'CONTACT'].includes(family ?? '')) {
      for (const key of ['email', 'phone', 'address']) if (key in props) props[key] = key === 'email' ? primaryEmail : key === 'phone' ? primaryPhone : details.address
      const template = importedSection(componentId)
      for (const field of template?.fields ?? []) {
        const key = field.path.slice(1), sample = template!.fixture[key] ?? ''
        if (sample.startsWith('mailto:')) props[key] = primaryEmail ? `mailto:${primaryEmail}` : ''
        else if (sample.startsWith('tel:')) props[key] = primaryPhone ? `tel:${primaryPhone}` : ''
        else if (field.type !== 'link' && field.type !== 'image' && /@/.test(sample)) props[key] = primaryEmail
        else if (field.type !== 'link' && field.type !== 'image' && /\d[\d ()+-]{5,}/.test(sample)) props[key] = primaryPhone
      }
    }
    if (family === 'FOOTER') Object.assign(props, { address: details.address, email: primaryEmail, phone: primaryPhone, emails: details.emails, phones: details.phones, socials: details.socials })
    if (family === 'HEADER') props.businessSocials = details.socials
    if (family === 'HEADER' && ('phone' in props || componentId === 'HeaderSplitUtility')) props.phone = primaryPhone
    if (family === 'CONTACT' && showDetails) Object.assign(props, { businessContact: details })
    if (Array.isArray(props.freeElements)) props.freeElements = props.freeElements.map(entry => entry && typeof entry === 'object' && entry.content && typeof entry.componentId === 'string' ? { ...entry, content: resolveProps(entry.componentId, entry.content, true) } : entry)
    return props
  }
  function contactInfo(section: WebsiteSection): boolean {
    const template = importedSection(section.componentId)
    return getComponent(section.componentId)?.family === 'CONTACT' && (!template || Object.values(template.fixture).some(value => /^(mailto:|tel:)/.test(value)))
  }
  return {
    ...model,
    navigation: resolveLinks(model.navigation) as WebsiteModel['navigation'],
    globalComponents: {
      header: { ...model.globalComponents.header, props: resolveProps(model.globalComponents.header.componentId, model.globalComponents.header.props) },
      footer: { ...model.globalComponents.footer, props: resolveProps(model.globalComponents.footer.componentId, model.globalComponents.footer.props) },
    },
    pages: model.pages.map(page => {
      const target = page.sections.find(section => !section.hidden && contactInfo(section)) ?? page.sections.find(section => !section.hidden && getComponent(section.componentId)?.family === 'CONTACT')
      return { ...page, sections: page.sections.map(section => ({ ...section, props: resolveProps(section.componentId, section.props, section.id === target?.id || section.componentId === 'ContactSplit') })) }
    }),
  }
}
