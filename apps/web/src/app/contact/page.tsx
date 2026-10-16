import { publicPageMetadata } from '@/lib/seo'
import type { Metadata } from 'next'
import { MarketingContact } from '@/components/marketing/contact'
import { MarketingShell } from '@/components/marketing/shell'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = publicPageMetadata('/contact')

export default function ContactPage() {
  return <MarketingShell active="/contact"><MarketingContact /></MarketingShell>
}
