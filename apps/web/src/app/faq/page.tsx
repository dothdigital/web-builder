import type { Metadata } from 'next'
import { MarketingFAQ } from '@/components/marketing/faq'
import { MarketingShell } from '@/components/marketing/shell'


export const metadata: Metadata = {
  title: "Frequently Asked Questions | Webtummy",
  description: "Answers about Webtummy AI website creation, editing, hosting, SEO and the US$29 monthly subscription.",
  alternates: { canonical: "https://webtummy.com/faq" },
}

export default function FAQPage() {
  return <MarketingShell active="/faq"><MarketingFAQ /></MarketingShell>
}
