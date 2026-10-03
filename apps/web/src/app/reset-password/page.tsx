import Link from 'next/link'
import { AuthFrame } from '@/components/account/auth-frame'
import { ActionForm } from '@/components/account/action-form'
import { finishAccountToken } from '@/app/actions/account'
export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams
  return <AuthFrame title="Choose your password" description="Updating your password signs out previous sessions."><ActionForm action={finishAccountToken} label="Save password"><input type="hidden" name="token" value={token ?? ''} /><input type="hidden" name="purpose" value="reset" /><label>New password<input name="password" type="password" autoComplete="new-password" minLength={12} maxLength={128} required /></label></ActionForm><p className="wt-auth-links"><Link href="/signin">Sign in</Link> · <Link href="/forgot-password">Request a new link</Link></p></AuthFrame>
}
