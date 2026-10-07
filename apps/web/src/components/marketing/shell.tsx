import Link from 'next/link'
import type { ReactNode } from 'react'
import styles from './marketing.module.css'

const navigation = [
  ['/', 'Home'], ['/how-it-works', 'How it works'], ['/pricing', 'Plans'],
  ['/about-us', 'About us'], ['/contact', 'Contact'],
] as const

export function MarketingShell({ active, children }: { active: string; children: ReactNode }) {
  return (
    <div className={styles.page}>
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
              <a className={styles.s208} href="https://www.facebook.com/dothdigital" target="_blank" aria-label="Facebook" rel="noopener noreferrer">
                <svg width="17" height="17" viewBox="0 0 24 24">
                  <path fill="currentColor" d="M14 8h3V4h-3c-2.8 0-4.5 1.7-4.5 4.6V11H7v4h2.5v9h4v-9H17l.5-4h-4V8.9c0-.6.3-.9.5-.9z">
                  </path>
                </svg>
              </a>
              <a className={styles.s208} href="https://twitter.com/dothdigital1?lang=en" target="_blank" aria-label="X" rel="noopener noreferrer">
                <svg width="17" height="17" viewBox="0 0 24 24">
                  <path fill="currentColor" d="M17.8 3h3.1l-6.8 7.8L22 21h-6.2l-4.9-6.4L5.3 21H2.2l7.3-8.3L2 3h6.4l4.4 5.8L17.8 3zm-1.1 16.2h1.7L7.4 4.7H5.6l11.1 14.5z">
                  </path>
                </svg>
              </a>
              <a className={styles.s208} href="https://www.instagram.com/dothdigital/" target="_blank" aria-label="Instagram" rel="noopener noreferrer">
                <svg width="17" height="17" viewBox="0 0 24 24">
                  <rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" strokeWidth="2">
                  </rect>
                  <circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="2">
                  </circle>
                  <circle cx="17.5" cy="6.5" r="1.2" fill="currentColor">
                  </circle>
                </svg>
              </a>
              <a className={styles.s208} href="https://www.linkedin.com/company/dothdigital/" target="_blank" aria-label="LinkedIn" rel="noopener noreferrer">
                <svg width="17" height="17" viewBox="0 0 24 24">
                  <path fill="currentColor" d="M4.98 3.5a2.5 2.5 0 110 5 2.5 2.5 0 010-5zM3 9h4v12H3zM9 9h3.8v1.7h.1c.5-1 1.8-2 3.8-2 4 0 4.8 2.6 4.8 6V21h-4v-5.6c0-1.3 0-3-1.9-3s-2.1 1.4-2.1 2.9V21H9z">
                  </path>
                </svg>
              </a>
            </div>
          </div>
          <div className={styles.s209}>
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
            {"© 2026 Webtummy. A product of Dot H Digital Inc."}
          </span>
          <span>
            {"Mississauga, ON, Canada"}
          </span>
        </div>
      </div>
    </footer>
    </div>
  )
}
