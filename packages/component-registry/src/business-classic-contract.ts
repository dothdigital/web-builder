import { importedSection, importedBackgroundImagePaths, templateGenerationComponents } from './imported-layouts'

export const BUSINESS_CLASSIC_ID = 'finbiz-1'
export const BUSINESS_CLASSIC_RULES = [
  'Use the Business Classic HTML as a fixed template. Preserve its section order, columns, cards, responsive classes, heading hierarchy, image positions and form structure.',
  'Write plain text only into the listed content slots. Never return HTML, CSS, classes, styles, layout choices, image URLs, navigation, component substitutions or extra props.',
  'Write concise copy to fit each slot. A headline is not a paragraph. Use one concise H1 of at most 84 characters; do not append the full business name when that makes it overflow.',
  'Every required headline and main paragraph must contain meaningful copy grounded in supplied business facts. Missing optional facts stay blank; do not copy demo statistics, reviews, credentials, team members or pricing.',
  'Keep CTA labels short and action-oriented. The application maps buttons and service cards to real destinations.',
  'Images are separate from copy. Use the supplied personal photo only in the designated introduction. Supporting images must match their section topic; do not invent the identity of an agent or employee.',
  'Palette, typography and layout come from the selected template and user choices. Do not propose or apply a different design direction.',
].join('\n')

export function businessClassicContract(path: string, hasReviews = false) {
  return templateGenerationComponents(BUSINESS_CLASSIC_ID, path, hasReviews).map(componentId => {
    const section = importedSection(componentId)!
    const textFields = section.fields.filter(field => field.type !== 'image' && field.type !== 'link')
    const mainHeading = textFields.find(field => field.headingLevel)
    const mainBody = textFields.filter(field => field.type === 'textarea').sort((a, b) => String(section.fixture[b.path.slice(1)] ?? '').length - String(section.fixture[a.path.slice(1)] ?? '').length)[0]
    return {
      componentId, family: section.family,
      fields: textFields.map(field => {
        const sample = String(section.fixture[field.path.slice(1)] ?? '')
        const role = field.headingLevel ? `heading_h${field.headingLevel}` : field.type === 'textarea' ? 'body_copy' : sample.length <= 35 ? 'short_label' : 'supporting_copy'
        return {
          key: field.path.slice(1), role,
          maxCharacters: field.headingLevel === 1 ? 84 : field.headingLevel === 2 ? 72 : field.headingLevel ? 56 : field.type === 'textarea' ? 360 : sample.length <= 35 ? 72 : 180,
          required: field === mainHeading || field === mainBody,
          example: sample,
        }
      }),
      imageSlots: section.fields.filter(field => field.type === 'image').map(field => ({ path: field.path, ownership: 'application', placement: importedBackgroundImagePaths(componentId).includes(field.path) ? 'background' : 'foreground', recommendedAspectRatio: importedBackgroundImagePaths(componentId).includes(field.path) ? '16:9' : '4:5', purpose: section.family === 'HERO' ? 'introductory image' : section.family === 'ABOUT' ? 'section-specific supporting image' : section.family === 'CONTACT' ? 'enquiry illustration' : 'section-specific image' })),
    }
  })
}

export function validateBusinessClassicCopy(content: { path: string; h1: string; sections: Array<{ componentId: string; hidden?: boolean; props: Record<string, unknown> }> }, path: string, hasReviews = false): string[] {
  const contract = businessClassicContract(path, hasReviews)
  const expectedIds = [...contract.map(section => section.componentId), 'FaqAccordion']
  const errors: string[] = []
  if (content.path !== path) errors.push(`Keep the page path ${path}`)
  if (!content.h1.trim() || content.h1.trim().length > 84) errors.push('Provide one concise H1 of 1–84 characters')
  if (content.sections.map(section => section.componentId).join(',') !== expectedIds.join(',')) errors.push('Preserve the exact Business Classic section order and FAQ position')
  for (const section of content.sections) {
    if (section.hidden) errors.push(`${section.componentId}: do not hide required sections`)
    const spec = contract.find(item => item.componentId === section.componentId)
    if (!spec) {
      if (section.componentId === 'FaqAccordion' && Object.keys(section.props).some(key => !['heading', 'items'].includes(key))) errors.push('FAQ: return only heading and items')
      continue
    }
    const allowed = new Set(spec.fields.map(field => field.key))
    for (const key of Object.keys(section.props)) if (!allowed.has(key)) errors.push(`${section.componentId}: ${key} is application-owned; return only documented text slots`)
    for (const field of spec.fields) {
      const text = section.props[field.key]
      if (typeof text !== 'string') { errors.push(`${section.componentId}.${field.key}: provide plain text`); continue }
      if (field.required && !text.trim()) errors.push(`${section.componentId}.${field.key}: essential ${field.role} is missing`)
      if (text.trim().length > field.maxCharacters) errors.push(`${section.componentId}.${field.key}: shorten ${field.role} to ${field.maxCharacters} characters`)
      if (/<\/?[a-z][^>]*>/i.test(text)) errors.push(`${section.componentId}.${field.key}: HTML is not allowed`)
    }
  }
  return errors
}
