import Link from 'next/link'
import type { ReactNode } from 'react'
import { SiteFooter } from './site-footer'
export function AuthFrame({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return <main className="wt-auth"><aside><Link href="/" className="wt-brand"><span>W</span> webtummy</Link><div><p className="wt-eyebrow">Your ideas. Online.</p><h1>A home for every<br />business you build.</h1><p>Create with AI, make it yours, and manage every website from one place.</p><div className="wt-auth-art"><span>CREATE</span><strong>Make something<br />that’s yours.</strong><i>✦</i></div></div><p>Built for your next chapter.</p></aside><section><div className="wt-auth-box"><Link href="/" className="wt-mobile-brand">webtummy</Link><h2>{title}</h2><p className="wt-muted">{description}</p>{children}<SiteFooter /></div></section></main>
}
