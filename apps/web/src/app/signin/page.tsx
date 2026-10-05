import { ErrorNotice } from '@/components/error-notice'
import { SocialButtons } from '@/components/account/social-buttons'
import Link from 'next/link'
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { currentUser } from '@/lib/tenancy'
import { loginAccount } from '@/app/actions/account'
import { ActionForm } from '@/components/account/action-form'
import marketingStyles from '@/components/marketing/marketing.module.css'
import styles from '../signup/signup.module.css'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Sign In | Webtummy', robots: { index: false, follow: false } }

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams
  if (await currentUser()) redirect('/dashboard')
  return <div className={`${marketingStyles.page} ${styles.page}`}>
    <header className={styles.header}><Link href="/" className={styles.brand}><span>w</span>webtummy</Link><Link href="/" className={styles.homeLink}>Back to home →</Link></header>
    <main className={styles.main}><div className={styles.layout}>
      <div className={styles.copy}>
        <div className={styles.verbs}>{['Design.', 'Build.', 'Optimize.', 'Deploy.', 'Run.', 'Grow.'].map(verb => <span key={verb}>{verb}</span>)}</div>
        <h2>Your Entire AI Growth Team.</h2>
        <p className={styles.subtitle}>One Simple Plan. US$29/Month.</p>
        <p className={styles.introduction}>Your website, content, SEO and hosting. Everything you need to keep your business growing.</p>
        <p className={styles.planNote}>1 Website. No free trial. Cancel renewal anytime.</p>
      </div>
      <section className={styles.card} aria-labelledby="signin-heading">
        <div className={styles.colorBar} aria-hidden="true">{Array.from({ length: 6 }, (_, index) => <span key={index} />)}</div>
        <h1 id="signin-heading">Welcome back.</h1><p className={styles.cardIntro}>Sign in to build, manage and grow your website.</p>
        {error && <ErrorNotice code="WT-AUTH-001" className="wt-message" message={error === 'OAuthAccountNotLinked' ? 'An account with this email already exists. Sign in with your password first, then connect Google from My account.' : 'Sign-in was not completed. Please try again or use email sign-in.'} />}
        <SocialButtons />
        <ActionForm action={loginAccount} label="Sign in"><label htmlFor="signin-email">Email address<input id="signin-email" name="email" type="email" autoComplete="email" placeholder="you@example.com" maxLength={254} required /></label><label htmlFor="signin-password">Password<input id="signin-password" name="password" type="password" autoComplete="current-password" maxLength={128} required /></label></ActionForm>
        <p className={styles.terms}><Link href="/forgot-password">Forgot or need to set a password?</Link></p>
        <div className={styles.accountLinks}><p>New here? <Link href="/signup">Create an account</Link></p><Link href="/pricing">Explore packages →</Link></div>
      </section>
    </div></main>
  </div>
}
