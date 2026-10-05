import { redirect } from 'next/navigation'
import { CUSTOMER_TEAMS_ENABLED } from '@/lib/features'
import Link from 'next/link'
import { currentUser } from '@/lib/tenancy'
import { AuthFrame } from '@/components/account/auth-frame'
import { ActionForm } from '@/components/account/action-form'
import { acceptInvitation } from '@/app/actions/team'
export default async function InvitePage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  if (!CUSTOMER_TEAMS_ENABLED) redirect('/dashboard')
  const user = await currentUser(); const { token } = await searchParams
  return <AuthFrame title="Join your team" description="Accept the invitation using the email address it was sent to.">{user ? <ActionForm action={acceptInvitation} label="Join workspace"><input type="hidden" name="token" value={token ?? ''} /><p>Signed in as {user.email}</p></ActionForm> : <p><Link href="/signin">Sign in</Link> or <Link href="/signup">create an account</Link>, then reopen this invitation link.</p>}</AuthFrame>
}
