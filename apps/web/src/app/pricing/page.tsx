import { publicPageMetadata } from '@/lib/seo'
import type { Metadata } from 'next'
import { MarketingPlans } from '@/components/marketing/plans'
import { MarketingShell } from '@/components/marketing/shell'


export const metadata: Metadata = publicPageMetadata('/pricing')

export default function PlansPage() {
  return <MarketingShell active="/pricing"><MarketingPlans /></MarketingShell>
}
