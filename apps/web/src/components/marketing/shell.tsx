import Link from 'next/link'
import type { ReactNode } from 'react'
import styles from './marketing.module.css'
import { PublicPageSchema } from '@/components/public-page-schema'
import { WEBSITE_BUILDER_PAGES } from '@/lib/seo-landings'

const navigation = [
  ['/', 'Home'], ['/how-it-works', 'How it works'], ['/pricing', 'Plans'],
  ['/about-us', 'About us'], ['/support', 'Support'], ['/contact', 'Contact'],
] as const

export function MarketingShell({ active, children }: { active: string; children: ReactNode }) {
  return (
    <div className={styles.page}>
      <PublicPageSchema path={active} />
      <a className={styles.skipLink} href="#main-content">Skip to content</a>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link href="/" className={styles.brand}><span>w</span>webtummy</Link>
          <nav className={styles.nav} aria-label="Main navigation">
            {navigation.map(([href, label]) => <Link key={href} href={href} aria-current={active === href ? 'page' : undefined}>{label}</Link>)}
          </nav>
          <div className={styles.accountLinks}>
            <Link href="/signup" className={styles.startButton}>Start free trial</Link>
            <Link href="/signin" className={styles.signIn}>Sign in</Link>
          </div>
        </div>
      </header>
      <main id="main-content" className={styles.main}>{children}</main>
    <footer className={styles.s199}>
      <div className={styles.s200}>
        <div className={styles.s201}>
          <div className={styles.s202}>
            <div className={styles.s203}>
              <div className={styles.s204}>
                {"w"}
              </div>
              <span className={styles.s205}>
                {"webtummy"}
              </span>
            </div>
            <p className={styles.s206}>
              {"One subscription. Your entire online growth stack."}
            </p>
            <div className={styles.s207}>
              <a className={styles.s208} href="https://www.facebook.com/webtummy" target="_blank" aria-label="Facebook" rel="noopener noreferrer">
                <svg width="17" height="17" viewBox="0 0 24 24">
                  <path fill="currentColor" d="M14 8h3V4h-3c-2.8 0-4.5 1.7-4.5 4.6V11H7v4h2.5v9h4v-9H17l.5-4h-4V8.9c0-.6.3-.9.5-.9z">
                  </path>
                </svg>
              </a>
            </div>
          </div>
          <div className={styles.s209}>
            <div className={styles.s181}>
              <span className={styles.s210}>Website builders</span>
              {WEBSITE_BUILDER_PAGES.map(page => <Link className={styles.s211} key={page.slug} href={`/${page.slug}`}>{page.label}</Link>)}
            </div>
            <div className={styles.s181}>
              <span className={styles.s210}>
                {"Product"}
              </span>
              <Link className={styles.s211} href="/how-it-works">
                {"How it works"}
              </Link>
              <Link className={styles.s211} href="/pricing">
                {"Plans"}
              </Link>
              <Link className={styles.s211} href="/faq">
                {"FAQ"}
              </Link>
            </div>
            <div className={styles.s181}>
              <span className={styles.s210}>
                {"Company"}
              </span>
              <Link className={styles.s211} href="/about-us">
                {"About us"}
              </Link>
              <Link className={styles.s211} href="/contact">
                {"Contact"}
              </Link>
            </div>
            <div className={styles.s181}>
              <span className={styles.s210}>
                {"Legal"}
              </span>
              <Link className={styles.s212} href="/terms">
                {"Terms of Use"}
              </Link>
              <Link className={styles.s212} href="/privacy">
                {"Privacy Policy"}
              </Link>
            </div>
          </div>
        </div>
        <div className={styles.s213}>
          <span>
            {"© 2026 Webtummy."}
          </span>
        </div>
      </div>
    </footer>
    </div>
  )
}
