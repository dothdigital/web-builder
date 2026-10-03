import Link from 'next/link'
import { AuthFrame } from '@/components/account/auth-frame'
import { ActionForm } from '@/components/account/action-form'
import { finishAccountToken } from '@/app/actions/account'
export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams
  return <AuthFrame title="Verify your email" description="Confirm your address to activate your account."><ActionForm action={finishAccountToken} label="Verify email"><input type="hidden" name="token" value={token ?? ''} /><input type="hidden" name="purpose" value="verify" /></ActionForm><p className="wt-auth-links"><Link href="/signin">Continue to sign in</Link></p></AuthFrame>
}
