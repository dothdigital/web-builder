import Link from 'next/link'
import { redirect } from 'next/navigation'
import { currentUser } from '@/lib/tenancy'
export default async function HomePage() {
  if (await currentUser()) redirect('/dashboard')
  return <main className="wt-public"><header><Link href="/" className="wt-brand"><span>W</span> webtummy</Link><nav className="flex items-center gap-6"><Link href="/pricing">Packages</Link><Link href="/signin">Sign in</Link></nav></header><section className="wt-landing"><p className="wt-eyebrow">YOUR IDEAS. ONLINE.</p><h1>Big ideas.<br /><em>Beautiful websites.</em></h1><p>Build with AI. Make it your own. Manage one website or an entire portfolio from your Webtummy workspace.</p><div className="flex justify-center gap-4"><Link href="/signup" className="wt-button">Start creating →</Link><Link href="/pricing" className="wt-button secondary">Explore packages</Link></div><div className="wt-landing-preview"><div className="wt-mini-browser"><i /><i /><i /><span>Your next chapter</span></div><div><h2>Made for<br />what’s next.</h2><span>✦</span></div><p>Your business. Your style. Your website.</p></div></section></main>
}
