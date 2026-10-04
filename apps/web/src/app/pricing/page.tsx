import Link from 'next/link'
import { prisma } from '@awb/database'
import { PlanCards } from '@/components/account/plan-cards'
import { SiteFooter } from '@/components/account/site-footer'
export const dynamic = 'force-dynamic'
export default async function PricingPage() {
  const plans = await prisma.billingPlan.findMany({ where: { active: true }, orderBy: { position: 'asc' }, include: { prices: { where: { active: true }, orderBy: { interval: 'asc' } } } })
  return <main className="wt-public"><header><Link href="/" className="wt-brand"><span>W</span> webtummy</Link><Link href="/signin">Sign in →</Link></header><div className="wt-heading text-center"><p className="wt-eyebrow">SIMPLE PLANS. MORE POSSIBILITIES.</p><h1>From your first site<br />to your whole portfolio.</h1><p>Choose your space to create. Upgrade as your business grows.</p></div><PlanCards plans={plans} /><p className="wt-muted mt-8 text-center">Monthly and yearly options appear when configured. Your full price is shown before payment.</p><SiteFooter /></main>
}
