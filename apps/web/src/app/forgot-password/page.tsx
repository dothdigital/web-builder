import Link from 'next/link'
import { AuthFrame } from '@/components/account/auth-frame'
import { ActionForm } from '@/components/account/action-form'
import { requestPasswordReset } from '@/app/actions/account'
export default function ForgotPasswordPage() {
  return <AuthFrame title="Set a new password" description="We’ll email a secure link. Existing accounts without a password can use this too."><ActionForm plainErrors action={requestPasswordReset} label="Send recovery link"><label>Email<input name="email" type="email" autoComplete="email" required /></label></ActionForm><p className="wt-auth-links"><Link href="/signin">Back to sign in</Link></p></AuthFrame>
}
