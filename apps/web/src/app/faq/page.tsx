import { publicPageMetadata } from '@/lib/seo'
import type { Metadata } from 'next'
import { MarketingFAQ } from '@/components/marketing/faq'
import { MarketingShell } from '@/components/marketing/shell'


export const metadata: Metadata = publicPageMetadata('/faq')

export default function FAQPage() {
  return <MarketingShell active="/faq"><MarketingFAQ /></MarketingShell>
}
