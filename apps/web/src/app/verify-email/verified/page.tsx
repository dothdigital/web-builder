import type { Metadata } from 'next'
import Link from 'next/link'
import { AccountConfirmation } from '@/components/account/account-confirmation'
import styles from '@/components/account/account-confirmation.module.css'

export const metadata: Metadata = { title: 'Email Verified | Webtummy', robots: { index: false, follow: false }, referrer: 'no-referrer' }

export default function EmailVerifiedPage() {
  return <AccountConfirmation><span className={styles.icon} aria-hidden="true">✓</span><h1>Email verified.</h1><p>Your email address is confirmed. Sign in to continue to your Webtummy account.</p><Link href="/signin" className={styles.button}>Sign in to continue →</Link><p>After signing in, choose the Individual plan for US$29/month to start building your website.</p></AccountConfirmation>
}
