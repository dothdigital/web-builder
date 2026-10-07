import { SocialButtons } from '@/components/account/social-buttons'
import Link from 'next/link'
import type { Metadata } from 'next'
import marketingStyles from '@/components/marketing/marketing.module.css'
import { ActionForm } from '@/components/account/action-form'
import { registerAccount } from '@/app/actions/account'
import styles from './signup.module.css'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = {
  title: 'Create Your Account | Webtummy',
  description: 'Full access free for 7 days for eligible new customers, then automatic US$29/month billing. Card required. Cancel before the trial ends to avoid a charge.',
  alternates: { canonical: 'https://webtummy.com/signup' },
}

const benefits = [
  ['AI website & copy', 'Design, pages and content created together.'],
  ['Full visual editor', 'Make it yours with visual and AI editing.'],
  ['SEO & discovery', 'Built-in SEO, local SEO, AEO and GEO tools.'],
  ['AI content & blogs', 'Keep creating as your business grows.'],
  ['Managed hosting', 'SSL, custom domain and analytics included.'],
  ['Security & reliability', 'Monitoring, backups and recovery capabilities.'],
] as const

export default function SignupPage() {
  const siteKey = process.env.CONTACT_RECAPTCHA_SITE_KEY
  const available = !!siteKey && !!process.env.CONTACT_RECAPTCHA_SECRET_KEY && process.env.CONTACT_RECAPTCHA_TYPE === 'v3'
  return (
    <div className={`${marketingStyles.page} ${styles.page}`}>
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
            <p className={styles.planNote}><strong>7-day free trial with full access.</strong> Eligible new customers only. Card required. Automatic US$29/month billing starts when your trial ends unless you cancel beforehand.</p>
            <ul className={styles.benefits}>{benefits.map(([title]) => <li key={title}><span aria-hidden="true">✓</span>{title}</li>)}</ul>
          </div>
          <section className={styles.card} aria-labelledby="signup-heading">
            <div className={styles.colorBar} aria-hidden="true">{Array.from({ length: 6 }, (_, index) => <span key={index} />)}</div>
            <h1 id="signup-heading">Create your account.</h1>
            <SocialButtons />
            <ActionForm plainErrors action={registerAccount} label="Create account" captchaSiteKey={available ? siteKey : undefined} disabled={!available}>
              <div className={styles.identity}>
                <label htmlFor="signup-name">Your name<input id="signup-name" name="name" autoComplete="name" placeholder="Your full name" minLength={2} maxLength={100} required /></label>
                <label htmlFor="signup-email">Email address<input id="signup-email" name="email" type="email" autoComplete="email" placeholder="you@example.com" maxLength={254} required /></label>
              </div>
              <label htmlFor="signup-password">Password<input id="signup-password" name="password" type="password" autoComplete="new-password" aria-describedby="password-help" minLength={12} maxLength={128} required /><small id="password-help">At least 12 characters.</small></label>
              <label className="wt-check"><input type="checkbox" name="marketingConsent" />Email me website tips and Webtummy offers. I can unsubscribe at any time.</label>
            </ActionForm>
            <p className={styles.terms}>By creating an account, you agree to our <Link href="/terms">Terms of Use</Link> and acknowledge our <Link href="/privacy">Privacy Policy</Link>.</p>
            <div className={styles.accountLinks}><p>Already have an account? <Link href="/signin">Sign in</Link></p><Link href="/pricing">Explore packages →</Link></div>
          </section>
        </div>
      </main>
    </div>
  )
}
