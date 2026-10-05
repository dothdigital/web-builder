import type { Metadata } from 'next'
import { MarketingPrivacy } from '@/components/marketing/privacy'
import { MarketingShell } from '@/components/marketing/shell'


export const metadata: Metadata = {
  title: "Privacy Policy | Webtummy",
  description: "How Webtummy handles your account, website and personal information, operated by DotH Digital Inc. in Ontario, Canada.",
  alternates: { canonical: "https://webtummy.com/privacy" },
}

export default function PrivacyPage() {
  return <MarketingShell active="/privacy"><MarketingPrivacy /></MarketingShell>
}
