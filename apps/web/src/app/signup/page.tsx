import { SocialButtons } from '@/components/account/social-buttons'
import Link from 'next/link'
import { AuthFrame } from '@/components/account/auth-frame'
import { ActionForm } from '@/components/account/action-form'
import { registerAccount } from '@/app/actions/account'
export const dynamic = 'force-dynamic'
export default function SignupPage() {
  const siteKey = process.env.CONTACT_RECAPTCHA_SITE_KEY
  const available = !!siteKey && !!process.env.CONTACT_RECAPTCHA_SECRET_KEY && process.env.CONTACT_RECAPTCHA_TYPE === 'v3'
  return <AuthFrame title="Start building with Webtummy" description="Try all editor and AI features free for 7 days. No payment required. Choose a paid plan when you’re ready to go live."><SocialButtons /><ActionForm action={registerAccount} label="Create account" captchaSiteKey={available ? siteKey : undefined} disabled={!available}><label>Your name<input name="name" autoComplete="name" minLength={2} maxLength={100} required /></label><label>Email<input name="email" type="email" autoComplete="email" required /></label><label>Password<input name="password" type="password" autoComplete="new-password" minLength={12} maxLength={128} required /><small>At least 12 characters.</small></label><label className="wt-check"><input type="checkbox" name="marketingConsent" /> Email me website tips, trial reminders and Webtummy offers. I can unsubscribe at any time.</label></ActionForm><p className="wt-auth-links">Already have an account? <Link href="/signin">Sign in</Link></p><Link href="/pricing">Explore packages →</Link></AuthFrame>
}
