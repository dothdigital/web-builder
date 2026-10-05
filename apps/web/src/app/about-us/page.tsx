import type { Metadata } from 'next'
import { MarketingAboutUs } from '@/components/marketing/about'
import { MarketingShell } from '@/components/marketing/shell'


export const metadata: Metadata = {
  title: "About Us | Webtummy",
  description: "Meet Webtummy and DotH Digital Inc., the team behind your AI Growth Team.",
  alternates: { canonical: "https://webtummy.com/about-us" },
}

export default function AboutUsPage() {
  return <MarketingShell active="/about-us"><MarketingAboutUs /></MarketingShell>
}
