import { publicPageMetadata } from '@/lib/seo'
import type { Metadata } from 'next'
import { MarketingAboutUs } from '@/components/marketing/about'
import { MarketingShell } from '@/components/marketing/shell'


export const metadata: Metadata = publicPageMetadata('/about-us')

export default function AboutUsPage() {
  return <MarketingShell active="/about-us"><MarketingAboutUs /></MarketingShell>
}
