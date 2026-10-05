import Link from 'next/link'
import type { ReactNode } from 'react'
import marketingStyles from '@/components/marketing/marketing.module.css'
import styles from './account-confirmation.module.css'

export function AccountConfirmation({ children }: { children: ReactNode }) {
  return <main className={`${marketingStyles.page} ${styles.page}`}><Link href="/" className={styles.brand}><span>w</span>webtummy</Link><section className={styles.card}>{children}</section><p className={styles.footer}>Your Entire AI Growth Team.</p></main>
}
