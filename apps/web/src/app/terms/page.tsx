import type { Metadata } from 'next'
import { MarketingTerms } from '@/components/marketing/terms'
import { MarketingShell } from '@/components/marketing/shell'


export const metadata: Metadata = {
  title: "Terms of Use | Webtummy",
  description: "Terms for Webtummy website creation, hosting, subscriptions and recovery, operated by DotH Digital Inc. in Ontario, Canada.",
  alternates: { canonical: "https://webtummy.com/terms" },
}

export default function TermsPage() {
  return <MarketingShell active="/terms"><MarketingTerms /></MarketingShell>
}
