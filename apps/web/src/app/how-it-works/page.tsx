import { publicPageMetadata } from '@/lib/seo'
import type { Metadata } from 'next'
import { MarketingHowItWorks } from '@/components/marketing/how'
import { MarketingShell } from '@/components/marketing/shell'


export const metadata: Metadata = publicPageMetadata('/how-it-works')

export default function HowItWorksPage() {
  return <MarketingShell active="/how-it-works"><MarketingHowItWorks /></MarketingShell>
}
