import type { Metadata } from 'next'
import { MarketingHome } from '@/components/marketing/home'
import { MarketingShell } from '@/components/marketing/shell'
import { redirect } from 'next/navigation'
import { currentUser } from '@/lib/tenancy'


export const metadata: Metadata = {
  title: "Webtummy — Your Entire AI Growth Team",
  description: "Design, build, optimize, deploy, run and grow your business website. One website and your AI Growth Team for US$29 per month.",
  alternates: { canonical: "https://webtummy.com/" },
}

export default async function HomePage() {
  if (await currentUser()) redirect('/dashboard')
  return <MarketingShell active="/"><MarketingHome /></MarketingShell>
}
