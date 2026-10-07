import Link from 'next/link'
import type { Metadata } from 'next'
import marketingStyles from '@/components/marketing/marketing.module.css'
import styles from '../signup.module.css'

export const metadata: Metadata = {
  title: '7 Days Free with Full Access | Webtummy',
  description: 'Full access free for 7 days for eligible new customers, then automatic US$29/month billing. Card required. Cancel before the trial ends to avoid a charge.',
  robots: { index: false, follow: false },
}

export default function TrialPage() {
  return <div className={`${marketingStyles.page} ${styles.page}`}>
    <header className={styles.header}>
      <Link href="/" className={styles.brand}><span>w</span>webtummy</Link>
      <Link href="/" className={styles.homeLink}>Back to home →</Link>
    </header>
    <main className={styles.main}>
      <div className={styles.layout}>
        <div className={styles.copy}>
          <div className={styles.verbs}>{['Design.', 'Build.', 'Optimize.', 'Deploy.', 'Run.', 'Grow.'].map(verb => <span key={verb}>{verb}</span>)}</div>
          <h2>Your Entire AI Growth Team.</h2>
          <p className={styles.subtitle}>7 Days Free. Then US$29/Month.</p>
          <p className={styles.introduction}>Build your website. Create your content. Get found. Host it. Secure it. Manage it. Grow it.</p>
          <ul className={styles.benefits}>{['AI website & copy', 'Full visual editor', 'SEO & discovery', 'AI content & blogs', 'Managed hosting', 'Security & reliability'].map(title => <li key={title}><span aria-hidden="true">✓</span>{title}</li>)}</ul>
        </div>
      <section className={styles.card} aria-labelledby="trial-heading">
        <div className={styles.colorBar} aria-hidden="true">{Array.from({ length: 6 }, (_, index) => <span key={index} />)}</div>
        <p className={styles.trialEyebrow}>Your Entire AI Growth Team.</p>
        <h1 id="trial-heading" className={styles.completionTitle}>7 days free with full access</h1>
        <p className={styles.trialDescription} role="status">Check your email to continue. If an account can use this email address, we’ll send you a verification email. Check your inbox and spam folder.</p>
        <ol className={styles.trialSteps}>
          <li>Verify your email using the link in your inbox.</li>
          <li>Add a card at checkout to activate your eligible trial.</li>
        </ol>
        <div className={styles.trialBilling}>
          <strong>Then US$29/month</strong>
          <p>Automatic US$29/month billing starts after 7 days unless you cancel before the trial ends. Eligible new customers only. Card required.</p>
        </div>
        <Link href="/verify-email" className={styles.trialButton}>Resend verification email →</Link>
        <Link href="/pricing" className={styles.trialPackages}>Explore packages →</Link>
        <p className={styles.recoveryLinks}>Already verified? <Link href="/signin">Log in →</Link></p>
      </section>
      </div>
    </main>
  </div>
}
