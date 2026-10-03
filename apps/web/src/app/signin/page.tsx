import { SocialButtons } from '@/components/account/social-buttons'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { currentUser } from '@/lib/tenancy'
import { loginAccount } from '@/app/actions/account'
import { AuthFrame } from '@/components/account/auth-frame'
import { ActionForm } from '@/components/account/action-form'
export default async function SignInPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams
  if (await currentUser()) redirect('/dashboard')
  return <AuthFrame title="Welcome back" description="Sign in to your Webtummy workspace.">{error && <p className="wt-message">{error === 'OAuthAccountNotLinked' ? 'An account with this email already exists. Sign in with your password first, then connect Google or Microsoft from My account.' : 'Sign-in was not completed. Please try again or use email sign-in.'}</p>}<SocialButtons /><ActionForm action={loginAccount} label="Sign in"><label>Email<input name="email" type="email" autoComplete="email" required /></label><label>Password<input name="password" type="password" autoComplete="current-password" maxLength={128} required /></label></ActionForm><p className="wt-auth-links"><Link href="/forgot-password">Forgot or need to set a password?</Link></p><p className="wt-muted">New here? <Link href="/signup">Create an account</Link></p></AuthFrame>
}
