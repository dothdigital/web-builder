import { publicPageMetadata } from '@/lib/seo'
import type { Metadata } from 'next'
import { MarketingTerms } from '@/components/marketing/terms'
import { MarketingShell } from '@/components/marketing/shell'


export const metadata: Metadata = publicPageMetadata('/terms')

export default function TermsPage() {
  return <MarketingShell active="/terms"><MarketingTerms /></MarketingShell>
}
