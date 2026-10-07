import type { Metadata } from 'next'
import { MarketingPlans } from '@/components/marketing/plans'
import { MarketingShell } from '@/components/marketing/shell'


export const metadata: Metadata = {
  title: "7-Day Free Trial, Then US$29 per Month | Webtummy",
  description: "One website, AI creation and editing, SEO, content, managed hosting and security. 7 days free for eligible new customers, then US$29 per month. Cancel renewal anytime.",
  alternates: { canonical: "https://webtummy.com/pricing" },
}

export default function PlansPage() {
  return <MarketingShell active="/pricing"><MarketingPlans /></MarketingShell>
}
