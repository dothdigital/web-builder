import { getComponent } from '@awb/component-registry'
import type { WebsitePage } from '@awb/website-model'
import type { GenerationBrief } from '@awb/ai'

export function applyTestimonials(pages: WebsitePage[], testimonials: GenerationBrief['testimonials']): WebsitePage[] {
  return pages.map((page) => {
    const sections = page.sections.filter((section) => getComponent(section.componentId)?.family !== 'REVIEWS')
    if (page.path === '/' && testimonials.length > 0) {
      let id = 'customer-reviews'
      while (sections.some((section) => section.id === id)) id += '-reviews'
      const contactIndex = sections.findIndex((section) => getComponent(section.componentId)?.family === 'CONTACT')
      sections.splice(contactIndex < 0 ? sections.length : contactIndex, 0, {
        id, componentId: 'ReviewsTrustStrip', componentVersion: '1.0.0', hidden: false,
        props: { heading: 'What our clients say', testimonials: testimonials.map((testimonial) => ({ ...testimonial })) },
      })
    } else if (testimonials.length > 0) {
      return { ...page, sections: page.sections.map((section) => getComponent(section.componentId)?.family === 'REVIEWS' ? { ...section, props: { ...section.props, testimonials } } : section) }
    }
    return { ...page, sections }
  })
}
