import type { Metadata } from 'next'
import { MarketingHowItWorks } from '@/components/marketing/how'
import { MarketingShell } from '@/components/marketing/shell'


export const metadata: Metadata = {
  title: "How It Works | Webtummy",
  description: "Tell us about your business, let AI plan and build your website, make it yours, publish and keep growing.",
  alternates: { canonical: "https://webtummy.com/how-it-works" },
}

export default function HowItWorksPage() {
  return <MarketingShell active="/how-it-works"><MarketingHowItWorks /></MarketingShell>
}
