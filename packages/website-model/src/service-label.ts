const acronyms = new Set(['AI', 'API', 'B2B', 'B2C', 'CRM', 'CSS', 'ERP', 'FAQ', 'GA4', 'GTM', 'HR', 'HTML', 'HVAC', 'IT', 'PPC', 'RDSP', 'RESP', 'RRIF', 'RRSP', 'SEO', 'SMS', 'TFSA', 'UI', 'URL', 'UX', 'VAT'])

/** Display casing only: route slugs and prose are handled separately. */
export function formatServiceLabel(value: string): string {
  return value.trim().replace(/\s+/g, ' ').replace(/[\p{L}\p{N}]+(?:['’][\p{L}]+)*/gu, word => {
    const upper = word.toUpperCase()
    if (acronyms.has(upper)) return upper
    // Preserve deliberately mixed-case names such as iPhone, eCommerce and WordPress.
    if (/^[a-z]+(?:[A-Z][a-z]+)+$/.test(word) || /^[A-Z][a-z]+(?:[A-Z][a-z]+)+$/.test(word)) return word
    const lower = word.toLowerCase()
    return lower.charAt(0).toUpperCase() + lower.slice(1)
  })
}
