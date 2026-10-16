import { publicPageMetadata } from '@/lib/seo'
import type { Metadata } from 'next'
import { MarketingHome } from '@/components/marketing/home'
import { MarketingShell } from '@/components/marketing/shell'
import { redirect } from 'next/navigation'
import { currentUser } from '@/lib/tenancy'


export const metadata: Metadata = publicPageMetadata('/')

export default async function HomePage() {
  if (await currentUser()) redirect('/dashboard')
  return <MarketingShell active="/"><MarketingHome /></MarketingShell>
}
