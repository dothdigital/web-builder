export const INDIVIDUAL_PLAN_SLUG = 'individual'
export const INDIVIDUAL_AMOUNT = 2900
export const INDIVIDUAL_CURRENCY = 'usd'
export const INDIVIDUAL_INTERVAL = 'month'
export const individualPriceFilter = { active: true, amount: INDIVIDUAL_AMOUNT, currency: INDIVIDUAL_CURRENCY, interval: INDIVIDUAL_INTERVAL }

export const INDIVIDUAL_FEATURE_GROUPS = [
  { title: 'Website', features: ['1 Website', 'AI Website Builder', 'AI Design', 'AI Copywriting', 'AI Images', 'Responsive Design', 'Full Visual Editor', 'AI Editing'] },
  { title: 'SEO & Discovery', features: ['Built-In SEO', 'Technical SEO', 'Local SEO Tools', 'Schema', 'Sitemap', 'AEO', 'GEO / AI Search Tools', 'SEO Recommendations'] },
  { title: 'Content & Growth', features: ['AI Content Creation', 'Blog Creation', 'Landing Pages', 'Growth Recommendations', 'Conversion Recommendations'] },
  { title: 'Hosting & Management', features: ['Managed Hosting', 'SSL', 'Custom Domain', 'Analytics', 'Performance Management', 'Website Monitoring'] },
  { title: 'Security & Reliability', features: ['Security Monitoring', 'Website Integrity Monitoring', 'Malware Monitoring', 'Backups', 'Recovery Capabilities'] },
] as const
export const INDIVIDUAL_FEATURES = INDIVIDUAL_FEATURE_GROUPS.flatMap(group => [...group.features])
