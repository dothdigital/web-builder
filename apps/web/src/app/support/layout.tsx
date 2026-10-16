import Link from 'next/link'
import type { ReactNode } from 'react'
import styles from './support.module.css'
export default function SupportLayout({ children }: { children: ReactNode }) {
 return <div className={styles.shell}>
  <a className={styles.skip} href="#support-main">Skip to content</a>
  <header className={styles.header}><div className={styles.headerInner}>
   <Link href="/" className={styles.brand}><span>w</span>webtummy<span className={styles.brandDivider} /> <small>Help center</small></Link>
   <nav aria-label="Support navigation"><Link href="/support">All guides</Link><Link href="/contact">Contact support</Link><Link className={styles.workspaceLink} href="/dashboard">Go to workspace <span aria-hidden>↗</span></Link></nav>
  </div></header>
  <main id="support-main">{children}</main>
  <footer className={styles.footer}><Link href="/support">Webtummy Help Center</Link><span>Step-by-step support for your website.</span><nav aria-label="Support footer"><Link href="/contact">Contact</Link><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link></nav></footer>
 </div>
}
