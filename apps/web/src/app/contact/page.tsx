import type { Metadata } from 'next'
import { MarketingContact } from '@/components/marketing/contact'
import { MarketingShell } from '@/components/marketing/shell'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: "Contact Us | Webtummy",
  description: "Talk to a real person on the Webtummy team. Get help with your website, account or Individual plan.",
  alternates: { canonical: "https://webtummy.com/contact" },
}

export default function ContactPage() {
  return <MarketingShell active="/contact"><MarketingContact /></MarketingShell>
}
