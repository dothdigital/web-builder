import { publicPageMetadata } from '@/lib/seo'
import type { Metadata } from 'next'
import { MarketingPrivacy } from '@/components/marketing/privacy'
import { MarketingShell } from '@/components/marketing/shell'


export const metadata: Metadata = publicPageMetadata('/privacy')

export default function PrivacyPage() {
  return <MarketingShell active="/privacy"><MarketingPrivacy /></MarketingShell>
}
